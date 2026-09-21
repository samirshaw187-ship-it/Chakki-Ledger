/**
 * Chakki Ledger - Firebase Authentication Service
 *
 * Implements Firebase Authentication integration:
 * - signInWithEmailAndPassword
 * - createUserWithEmailAndPassword
 * - sendPasswordResetEmail (Controlled by Administrator)
 * - signOut
 * - onAuthStateChanged listener
 *
 * Security & Integrity:
 * - Plaintext passwords are NEVER stored in Firestore documents.
 * - Password reset can only be initiated by Administrator via Admin controls.
 * - Shop Owner sets password once during account creation; cannot independently reset it.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { dbRepository } from '../db/in-memory-db';
import { FirebaseSyncService } from '../lib/firebase-sync.service';
import { AuditService } from '../services/audit.service';
import { User, UserRole, AuditAction } from '../types';
import { AuthSession, LoginResult, isValidGmail, isValidPassword } from '../modules/auth';

export class FirebaseAuthService {
  /**
   * Initializes Firebase Auth listener to maintain authenticated state
   */
  public static initAuthListener(onUserChanged: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser && fbUser.email) {
        // Find profile in dbRepository
        let localUser = dbRepository.getUserByEmail(fbUser.email);
        if (!localUser) {
          try {
            const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
            if (userSnap.exists()) {
              localUser = userSnap.data() as User;
              dbRepository.addUser(localUser);
            }
          } catch (e) {
            console.warn('initAuthListener doc fetch notice:', e);
          }
        }
        if (localUser) {
          onUserChanged(localUser);
          return;
        }
      }
      onUserChanged(null);
    });
  }

  /**
   * Sign in with email and password via Firebase Auth
   */
  public static async signIn(
    email: string,
    password: string,
    expectedRole?: UserRole
  ): Promise<LoginResult> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address' };
    }

    if (!isValidGmail(cleanEmail)) {
      return {
        success: false,
        error: 'Email format must end with @gmail.com (e.g. name@gmail.com)',
      };
    }

    const passCheck = isValidPassword(password);
    if (!passCheck.isValid) {
      return {
        success: false,
        error:
          'Password must include at least one uppercase letter, one lowercase letter, one number, and one symbol.',
      };
    }

    try {
      // 1. Authenticate with Firebase Auth
      let fbUserCred;
      try {
        fbUserCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (authErr: any) {
        // If user doesn't exist in Firebase Auth yet, check if this is initial Admin or newly approved user
        const existingProfile = dbRepository.getUserByEmail(cleanEmail);
        if (existingProfile && existingProfile.password === password) {
          try {
            // Auto-provision into Firebase Auth for seamless transition
            fbUserCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          } catch (createErr: any) {
            console.warn('Firebase Auth auto-provision fallback notice:', createErr.message);
          }
        }

        if (!fbUserCred) {
          if (existingProfile && existingProfile.role === UserRole.ADMIN && existingProfile.password === password) {
            console.info('[Auth] Admin recognized from database credentials. Establishing admin session.');
            const now = new Date().toISOString();
            dbRepository.updateUser(existingProfile.id, { lastLoginAt: now });
            const session: AuthSession = {
              user: { ...existingProfile, lastLoginAt: now },
              token: `admin_token_${existingProfile.id}_${Date.now()}`,
              role: existingProfile.role,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
            return { success: true, session };
          }

          if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            return { success: false, error: 'Incorrect password. Please try again.' };
          }
          if (authErr.code === 'auth/user-not-found') {
            return { success: false, error: 'No account registered with this @gmail.com address.' };
          }
          return { success: false, error: authErr.message || 'Authentication failed with Firebase Auth.' };
        }
      }

      // 2. Fetch User Profile from Firestore / dbRepository
      let user = dbRepository.getUserByEmail(cleanEmail);
      if (!user) {
        return { success: false, error: 'No user profile found. Please register or contact Admin.' };
      }

      // 3. Enforce Role Isolation
      if (expectedRole) {
        if (expectedRole === UserRole.ADMIN && user.role !== UserRole.ADMIN) {
          return {
            success: false,
            error: 'This account is not authorized as an Administrator. Please select Shop Owner login.',
          };
        }
        if (expectedRole === UserRole.OWNER && user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
          return {
            success: false,
            error: 'This account is not a Shop Owner account. Please select Administrator login.',
          };
        }
      }

      // 4. Enforce Account Status for Shop Owners
      if (user.role === UserRole.OWNER) {
        if (user.approvalStatus === 'PENDING_APPROVAL') {
          return {
            success: false,
            error:
              'Your application for creating a Shop Owner account is currently under review. Please wait for Admin approval before signing in.',
          };
        }
        if (user.approvalStatus === 'SUSPENDED') {
          return {
            success: false,
            error: 'Your Shop Owner account has been temporarily suspended by the Administrator.',
          };
        }
        if (user.approvalStatus === 'DEACTIVATED' || !user.isActive) {
          return {
            success: false,
            error: 'Your Shop Owner account has been deactivated. Please contact the administrator.',
          };
        }
      } else if (!user.isActive) {
        return {
          success: false,
          error: 'Account is deactivated. Please contact the administrator.',
        };
      }

      // 5. Update last login & sync User Profile to Firestore under the authenticated UID
      const now = new Date().toISOString();
      const authUid = fbUserCred.user.uid;

      try {
        const userDocRef = doc(db, 'users', authUid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          const profileDoc: User = {
            id: authUid,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            approvalStatus: user.approvalStatus,
            createdAt: user.createdAt || now,
            lastLoginAt: now,
          };
          await setDoc(userDocRef, profileDoc, { merge: true });
          dbRepository.updateUser(user.id, { id: authUid, lastLoginAt: now });
          user = { ...profileDoc };
        } else {
          await setDoc(userDocRef, { lastLoginAt: now }, { merge: true });
          dbRepository.updateUser(user.id, { lastLoginAt: now });
        }
      } catch (docErr) {
        console.warn('Firestore user profile sync on login notice:', docErr);
        dbRepository.updateUser(user.id, { lastLoginAt: now });
      }

      const token = await fbUserCred.user.getIdToken();

      const session: AuthSession = {
        user: { ...user, lastLoginAt: now },
        token,
        role: user.role,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Record immutable audit event
      AuditService.log({
        action: AuditAction.LOGIN,
        entityType: 'AUTH',
        entityId: user.id,
        performedById: user.id,
        performedByName: user.name,
        reason: `Firebase Auth login successful (${user.role}: ${user.email})`,
      });

      return { success: true, session };
    } catch (err: any) {
      console.error('Sign-in error:', err);
      return { success: false, error: err.message || 'Failed to sign in.' };
    }
  }

  /**
   * Register a new Shop Owner application with Firebase Auth
   * Note: Plaintext passwords are NOT persisted into Firestore.
   */
  public static async registerShopOwner(data: {
    name: string;
    phone: string;
    email: string;
    address: string;
    password: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanName = data.name.trim();
    const cleanPhone = data.phone.trim().replace(/\D/g, '');
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanAddress = data.address.trim();
    const password = data.password;

    if (!cleanName) {
      return { success: false, error: 'Please enter your full name' };
    }

    if (cleanPhone.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }

    if (!isValidGmail(cleanEmail)) {
      return { success: false, error: 'Email format must be a valid @gmail.com address' };
    }

    if (!cleanAddress) {
      return { success: false, error: 'Please enter your chakki / shop address' };
    }

    const passCheck = isValidPassword(password);
    if (!passCheck.isValid) {
      return {
        success: false,
        error:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol',
      };
    }

    // Check duplicate email or phone in repository
    const existingByEmail = dbRepository.getUserByEmail(cleanEmail);
    if (existingByEmail) {
      return {
        success: false,
        error: `An account with ${cleanEmail} already exists. Please sign in or use a different email.`,
      };
    }

    const existingByPhone = dbRepository.getUserByPhone(cleanPhone);
    if (existingByPhone) {
      return {
        success: false,
        error: `Mobile number +91 ${cleanPhone} is already registered (${existingByPhone.name}).`,
      };
    }

    try {
      // 1. Create credentials in Firebase Auth
      let fbUser;
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        fbUser = cred.user;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          return {
            success: false,
            error: `An account with ${cleanEmail} already exists in Firebase. Please sign in.`,
          };
        }
        return {
          success: false,
          error: authErr.message || 'Firebase Auth failed to create user account.',
        };
      }

      // 2. Save profile in Firestore with UID matching Firebase Auth
      // Password is NEVER saved in Firestore
      const newUser: User = {
        id: fbUser.uid,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        address: cleanAddress,
        role: UserRole.OWNER,
        approvalStatus: 'PENDING_APPROVAL',
        isActive: false,
        createdAt: new Date().toISOString(),
      };

      // Synchronize to Firestore & local db
      dbRepository.addUser(newUser);
      await FirebaseSyncService.saveUser(newUser);

      // 3. Immutable audit log
      AuditService.log({
        action: AuditAction.CREATE,
        entityType: 'SHOP_OWNER_APPLICATION',
        entityId: newUser.id,
        performedById: newUser.id,
        performedByName: cleanName,
        reason: `New Shop Owner application created with Firebase Auth (${cleanEmail})`,
      });

      return { success: true, user: newUser };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, error: err.message || 'Error occurred during registration.' };
    }
  }

  /**
   * Admin-controlled password reset for a Shop Owner
   * Triggers an official Firebase password reset email to the owner.
   * Shop owners cannot independently change their password without admin initiation.
   */
  public static async adminInitiatePasswordReset(
    targetEmail: string,
    adminUser: User
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (adminUser.role !== UserRole.ADMIN) {
      return { success: false, error: 'Unauthorized: Only Administrators can trigger password resets.' };
    }

    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Target user email is required.' };
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);

      const targetUser = dbRepository.getUserByEmail(cleanEmail);
      if (targetUser) {
        dbRepository.updateUser(targetUser.id, {
          resetRequested: true,
          resetInitiatedAt: new Date().toISOString(),
        } as any);
      }

      AuditService.log({
        action: AuditAction.STATUS_CHANGE,
        entityType: 'PASSWORD_RESET',
        entityId: targetUser?.id || cleanEmail,
        performedById: adminUser.id,
        performedByName: adminUser.name,
        reason: `Administrator ${adminUser.name} triggered Firebase password reset email for ${cleanEmail}`,
      });

      return {
        success: true,
        message: `Secure password reset link has been dispatched to ${cleanEmail}. The Shop Owner can now set their new password.`,
      };
    } catch (err: any) {
      console.error('Password reset initiation error:', err);
      return { success: false, error: err.message || 'Failed to dispatch password reset email.' };
    }
  }

  /**
   * Sign out from Firebase Auth
   */
  public static async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase sign-out warning:', e);
    }
  }
}
