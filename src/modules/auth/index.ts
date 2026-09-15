/**
 * Chakki Ledger - Authentication & Session Management Module
 *
 * Core Features:
 * - Mobile-first PIN & Phone Authentication for shop operators & owners
 * - Secure session state with sessionStorage fallback & reactive event listeners
 * - Non-destructive audit logging on login, role switch, and logout
 * - Centralized Role-Based Access Control (RBAC) integration
 */

import { User, UserRole, AuditAction } from '../../types';
import { dbRepository } from '../../db/in-memory-db';
import { AuditService } from '../../services/audit.service';
import { Permission, hasPermission, canAccessRoute, ROLE_METADATA } from './permissions';
import { validateGmail, validatePassword } from './validation';
import { auth } from '../../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { FirestoreSyncService } from '../../services/firestore-sync.service';

export * from './permissions';
export * from './validation';

export interface AuthSession {
  user: User;
  token: string;
  role: UserRole;
  expiresAt: string;
  firebaseUid?: string;
}

export interface LoginResult {
  success: boolean;
  session?: AuthSession;
  isPendingApproval?: boolean;
  pendingUser?: User;
  error?: string;
  message?: string;
}

export function isSystemAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean === 'samirpc187@gmail.com' || clean === 'samirshaw869@gmail.com';
}

const SESSION_STORAGE_KEY = 'chakki_ledger_auth_session';

export class AuthService {
  private static listeners: Set<(session: AuthSession | null) => void> = new Set();
  private static pendingListeners: Set<(user: User) => void> = new Set();
  private static authStateInitialized = false;

  public static onPendingApproval(listener: (user: User) => void): () => void {
    this.pendingListeners.add(listener);
    return () => {
      this.pendingListeners.delete(listener);
    };
  }

  public static notifyPendingApproval(user: User): void {
    for (const listener of this.pendingListeners) {
      try {
        listener(user);
      } catch (e) {
        console.warn('Pending approval notification error:', e);
      }
    }
  }

  private static currentSession: AuthSession | null = (() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (saved) {
          const parsed: AuthSession = JSON.parse(saved);
          // Check expiration
          if (new Date(parsed.expiresAt).getTime() > Date.now()) {
            return parsed;
          } else {
            window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      }
    } catch (e) {
      console.warn('Unable to restore session from sessionStorage:', e);
    }

    // Default to unauthenticated until user signs in
    return null;
  })();

  /**
   * Initialize Firebase Auth listener to automatically synchronize Firebase Auth state
   */
  public static initAuthListener(): void {
    if (this.authStateInitialized) return;
    this.authStateInitialized = true;

    // Trigger initial Firestore sync only if active session exists
    if (this.currentSession) {
      FirestoreSyncService.initialize().catch((err) => {
        console.warn('Firestore initial sync deferred:', err);
      });
    }

    try {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser && firebaseUser.email) {
          const email = firebaseUser.email.toLowerCase();
          const isAdmin = isSystemAdminEmail(email);

          let user = dbRepository.getUserByEmail(email);
          if (!user) {
            // Register or map this Firebase user into our db
            user = dbRepository.addUser({
              name: firebaseUser.displayName || email.split('@')[0],
              email: email,
              role: isAdmin ? UserRole.ADMIN : UserRole.OWNER,
              isActive: isAdmin ? true : false,
              isApproved: isAdmin ? true : false,
              approvalStatus: isAdmin ? 'APPROVED' : 'PENDING',
              authProvider: 'google',
            });
            await FirestoreSyncService.saveUser(user);
          }

          // Strict gate: Block unapproved users immediately!
          if (user.role === UserRole.OWNER && (!user.isApproved || user.approvalStatus === 'PENDING')) {
            this.saveSession(null);
            try {
              await firebaseSignOut(auth);
            } catch {}
            this.notifyPendingApproval(user);
            return;
          }

          if (user.approvalStatus === 'REJECTED' || !user.isActive) {
            this.saveSession(null);
            try {
              await firebaseSignOut(auth);
            } catch {}
            return;
          }

          const session: AuthSession = {
            user,
            token: `fb_token_${user.id}_${Date.now()}`,
            role: user.role,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            firebaseUid: firebaseUser.uid,
          };

          this.saveSession(session);
        }
      });
    } catch (e) {
      console.warn('Firebase onAuthStateChanged setup error:', e);
    }
  }

  /**
   * Subscribe to session state changes
   */
  public static subscribe(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }

  private static saveSession(session: AuthSession | null): void {
    this.currentSession = session;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (session) {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        } else {
          window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to persist session to sessionStorage:', e);
    }

    if (session) {
      FirestoreSyncService.initialize().catch((err) => {
        console.warn('Firestore sync init error:', err);
      });
    } else {
      FirestoreSyncService.cleanup();
    }

    this.notifyListeners();
  }

  /**
   * Retrieve active session
   */
  public static getSession(): AuthSession | null {
    // Validate expiration
    if (this.currentSession && new Date(this.currentSession.expiresAt).getTime() <= Date.now()) {
      this.logout();
      return null;
    }
    return this.currentSession;
  }

  /**
   * Retrieve currently authenticated user
   */
  public static getCurrentUser(): User | null {
    return this.getSession()?.user || null;
  }

  /**
   * Check if user is authenticated
   */
  public static isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Authenticate via Gmail Address and Password with Firebase Authentication
   * Requirements:
   * - Email: Must end with @gmail.com
   * - Password: Min 8 chars, >=1 special char, >=1 number, >=1 uppercase, >=1 lowercase
   */
  public static async login(email: string, password: string): Promise<LoginResult> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    // 1. Email validation (@gmail.com requirement)
    const emailValidation = validateGmail(cleanEmail);
    if (!emailValidation.isValid) {
      return { success: false, error: emailValidation.error || 'Please enter a valid Gmail address ending in @gmail.com' };
    }

    // 2. Password validation (min 8 chars, 1 special char, 1 number, 1 uppercase, 1 lowercase)
    const passwordValidation = validatePassword(cleanPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.error || 'Password does not meet security requirements.' };
    }

    // 3. User lookup by email in repository
    let user = dbRepository.getUserByEmail(cleanEmail);
    if (!user) {
      // User request 1: If Login credentials not available in database it means user has to Create Account
      return {
        success: false,
        error: 'Account does not exist for this Gmail address. Please click "Create Account" below to register.',
      };
    }

    // Check admin approval requirement for Shop Owners
    if (user.role === UserRole.OWNER && (!user.isApproved || user.approvalStatus === 'PENDING')) {
      this.notifyPendingApproval(user);
      return {
        success: false,
        isPendingApproval: true,
        pendingUser: user,
        error: 'Registration request submitted. Please wait for Administrator approval. Thank you.',
      };
    }

    if (user.approvalStatus === 'REJECTED') {
      return {
        success: false,
        error: 'Your account registration was rejected by the Administrator. Please contact support.',
      };
    }

    if (!user.isActive) {
      return { success: false, error: 'This account has been deactivated. Please contact the administrator.' };
    }

    // 4. Verify password against local / seed credential
    const expectedPassword = user.password || ROLE_METADATA[user.role]?.demoPassword;
    if (expectedPassword && cleanPassword !== expectedPassword) {
      return { success: false, error: 'Incorrect password. Please verify and try again.' };
    }

    // 5. Attempt Firebase Authentication (Sign In or Auto Register in Firebase Auth)
    let firebaseUid: string | undefined;
    try {
      const fbCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      firebaseUid = fbCredential.user.uid;
    } catch (fbErr: any) {
      // If user doesn't exist in Firebase Auth yet, automatically register them
      if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential') {
        try {
          const newCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          firebaseUid = newCredential.user.uid;
        } catch (createErr: any) {
          console.warn('Firebase Auth user registration note:', createErr.code || createErr.message);
        }
      } else {
        console.warn('Firebase Auth sign in note:', fbErr.code || fbErr.message);
      }
    }

    // 6. Update last login timestamp & sync to Firestore
    dbRepository.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    await FirestoreSyncService.saveUser({ ...user, lastLoginAt: new Date().toISOString() });

    const session: AuthSession = {
      user: { ...user, lastLoginAt: new Date().toISOString() },
      token: `token_${user.id}_${Date.now()}`,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      firebaseUid,
    };

    this.saveSession(session);

    // 7. Audit log
    AuditService.log({
      action: AuditAction.LOGIN,
      entityType: 'AUTH',
      entityId: user.id,
      performedById: user.id,
      performedByName: user.name,
      reason: `User logged in with password (${user.role}) into Firebase`,
    });

    return { success: true, session };
  }

  /**
   * Sign In / Sign Up with Google using Firebase Authentication
   */
  public static async signInWithGoogle(): Promise<LoginResult> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      if (!fbUser.email) {
        return { success: false, error: 'Google account did not provide an email address.' };
      }

      const email = fbUser.email.toLowerCase();
      let user = dbRepository.getUserByEmail(email);

      if (!user) {
        // Register new Google user
        const isAdmin = email === 'samirpc187@gmail.com' || email.includes('admin');
        user = dbRepository.addUser({
          name: fbUser.displayName || email.split('@')[0],
          email: email,
          phone: fbUser.phoneNumber || undefined,
          role: isAdmin ? UserRole.ADMIN : UserRole.OWNER,
          isActive: isAdmin ? true : false,
          isApproved: isAdmin ? true : false,
          approvalStatus: isAdmin ? 'APPROVED' : 'PENDING',
          authProvider: 'google',
        });
        await FirestoreSyncService.saveUser(user);

        AuditService.log({
          action: AuditAction.USER_REGISTERED,
          entityType: 'AUTH',
          entityId: user.id,
          performedById: user.id,
          performedByName: user.name,
          reason: isAdmin
            ? `Admin account registered via Google (${email})`
            : `Shop Owner account registered via Google (${email}), pending Admin approval`,
        });
      }

      // Check approval for Shop Owners
      if (user.role === UserRole.OWNER && (!user.isApproved || user.approvalStatus === 'PENDING')) {
        try {
          await firebaseSignOut(auth);
        } catch {}
        this.saveSession(null);
        this.notifyPendingApproval(user);
        return {
          success: false,
          isPendingApproval: true,
          pendingUser: user,
          message: 'Registration request submitted. Please wait for Administrator approval. Thank you.',
        };
      }

      if (user.approvalStatus === 'REJECTED') {
        return {
          success: false,
          error: 'This Google account registration was rejected by the Administrator.',
        };
      }

      if (!user.isActive) {
        return { success: false, error: 'This account has been deactivated. Please contact the administrator.' };
      }

      dbRepository.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      await FirestoreSyncService.saveUser({ ...user, lastLoginAt: new Date().toISOString() });

      const session: AuthSession = {
        user: { ...user, lastLoginAt: new Date().toISOString() },
        token: `google_token_${user.id}_${Date.now()}`,
        role: user.role,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        firebaseUid: fbUser.uid,
      };

      this.saveSession(session);

      AuditService.log({
        action: AuditAction.LOGIN,
        entityType: 'AUTH',
        entityId: user.id,
        performedById: user.id,
        performedByName: user.name,
        reason: `User logged in with Google (${user.role})`,
      });

      return { success: true, session };
    } catch (err: any) {
      console.warn('Google sign-in exception:', err);
      // Helpful message for popup blocked or cancellation
      if (err.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Google sign-in popup was closed before completing.' };
      }
      return { success: false, error: err.message || 'Google sign-in failed.' };
    }
  }

  /**
   * Register a new account (Shop Owner or Admin)
   * If Shop Owner registers, admin approval is mandatory before they can log in.
   */
  public static async register(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }): Promise<{
    success: boolean;
    user?: User;
    error?: string;
    message?: string;
    isPendingApproval?: boolean;
    pendingUser?: Partial<User>;
  }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPassword = data.password;

    const emailValidation = validateGmail(cleanEmail);
    if (!emailValidation.isValid) {
      return { success: false, error: emailValidation.error || 'Please enter a valid Gmail address (@gmail.com).' };
    }

    const passwordValidation = validatePassword(cleanPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.error || 'Password does not meet security requirements.' };
    }

    // Check duplicate
    const existing = dbRepository.getUserByEmail(cleanEmail);
    if (existing) {
      return { success: false, error: 'An account with this Gmail address already exists. Please log in.' };
    }

    // Create user in Firebase Auth
    try {
      await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    } catch (fbErr: any) {
      if (fbErr.code !== 'auth/email-already-in-use') {
        console.warn('Firebase createUser note:', fbErr.message);
      }
    }

    // Determine role & approval status
    const isAdmin = cleanEmail === 'samirpc187@gmail.com' || data.role === UserRole.ADMIN;
    const role = isAdmin ? UserRole.ADMIN : UserRole.OWNER;
    const requiresApproval = role === UserRole.OWNER;

    const newUser = dbRepository.addUser({
      name: data.name.trim(),
      email: cleanEmail,
      phone: data.phone?.trim(),
      role,
      isActive: !requiresApproval,
      isApproved: !requiresApproval,
      approvalStatus: requiresApproval ? 'PENDING' : 'APPROVED',
      password: cleanPassword,
      authProvider: 'password',
    });

    await FirestoreSyncService.saveUser(newUser);

    AuditService.log({
      action: AuditAction.USER_REGISTERED,
      entityType: 'AUTH',
      entityId: newUser.id,
      performedById: newUser.id,
      performedByName: newUser.name,
      reason: requiresApproval
        ? `Shop Owner account registered by ${newUser.name} (${cleanEmail}). Pending Admin approval.`
        : `Admin account registered by ${newUser.name} (${cleanEmail}).`,
    });

    if (requiresApproval) {
      try {
        await firebaseSignOut(auth);
      } catch {}
      this.saveSession(null);
      this.notifyPendingApproval(newUser);
      return {
        success: true,
        user: newUser,
        isPendingApproval: true,
        pendingUser: newUser,
        message: 'Registration request submitted. Please wait for Administrator approval. Thank you.',
      };
    }

    return {
      success: true,
      user: newUser,
      message: 'Admin account created successfully! You can now log in.',
    };
  }

  /**
   * Update User Password (for Owner and Admin settings)
   * Synchronizes password changes to both in-memory store and remote Firestore
   */
  public static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = dbRepository.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User account not found.' };
    }

    const expectedPassword = user.password || ROLE_METADATA[user.role]?.demoPassword;
    if (expectedPassword && currentPassword !== expectedPassword) {
      return { success: false, error: 'Current password does not match.' };
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.error || 'New password does not meet security requirements.' };
    }

    const updated = dbRepository.updateUser(userId, { password: newPassword });
    if (updated) {
      await FirestoreSyncService.saveUser(updated);
    }

    // Also attempt updating password in Firebase Auth if current user is active
    try {
      if (auth.currentUser && auth.currentUser.email?.toLowerCase() === user.email.toLowerCase()) {
        await firebaseUpdatePassword(auth.currentUser, newPassword);
      }
    } catch (e: any) {
      console.warn('Firebase Auth updatePassword note:', e.message);
    }

    AuditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'USER',
      entityId: userId,
      performedById: userId,
      performedByName: user.name,
      reason: `Password updated and synced to Firestore database for ${user.name} (${user.role}).`,
    });

    if (this.currentSession && this.currentSession.user.id === userId) {
      this.currentSession.user.password = newPassword;
      this.saveSession({ ...this.currentSession });
    }

    return { success: true };
  }

  /**
   * Administrator approves or rejects a pending Shop Owner account
   */
  public static async approveUser(
    adminUser: User,
    userId: string,
    approve: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (adminUser.role !== UserRole.ADMIN) {
      return { success: false, error: 'Unauthorized: Only administrators can approve or reject accounts.' };
    }

    const targetUser = dbRepository.getUserById(userId);
    if (!targetUser) {
      return { success: false, error: 'Target user not found.' };
    }

    const updates: Partial<User> = {
      isApproved: approve,
      isActive: approve,
      approvalStatus: approve ? 'APPROVED' : 'REJECTED',
    };

    const updated = dbRepository.updateUser(userId, updates);
    if (updated) {
      await FirestoreSyncService.saveUser(updated);
    }

    AuditService.log({
      action: approve ? AuditAction.ACCOUNT_APPROVED : AuditAction.ACCOUNT_REJECTED,
      entityType: 'USER',
      entityId: userId,
      performedById: adminUser.id,
      performedByName: `${adminUser.name} (Admin)`,
      reason: approve
        ? `Account for ${targetUser.name} (${targetUser.email}) was APPROVED by Admin.`
        : `Account for ${targetUser.name} (${targetUser.email}) was REJECTED by Admin.`,
    });

    return { success: true };
  }

  /**
   * Fast 1-click role switch for development and demonstration
   */
  public static loginAsRole(role: UserRole): AuthSession {
    const users = dbRepository.getUsers();
    let user = users.find((u) => u.role === role && u.isActive);
    if (!user) {
      user = users.find((u) => u.role === role) || users[0];
    }

    dbRepository.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    const session: AuthSession = {
      user: { ...user, lastLoginAt: new Date().toISOString() },
      token: `dev_token_${role.toLowerCase()}_${Date.now()}`,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.saveSession(session);

    AuditService.log({
      action: AuditAction.LOGIN,
      entityType: 'AUTH',
      entityId: user.id,
      performedById: user.id,
      performedByName: user.name,
      reason: `Switched session to role ${role} (${user.name})`,
    });

    return session;
  }

  /**
   * Alias for backward compatibility with existing codebase
   */
  public static switchRole(role: UserRole): AuthSession {
    return this.loginAsRole(role);
  }

  /**
   * Terminate current session & sign out of Firebase
   */
  public static async logout(): Promise<void> {
    const current = this.currentSession;
    if (current) {
      AuditService.log({
        action: AuditAction.LOGOUT,
        entityType: 'AUTH',
        entityId: current.user.id,
        performedById: current.user.id,
        performedByName: current.user.name,
        reason: `User logged out`,
      });
    }

    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Firebase sign out error:', err);
    }

    this.saveSession(null);
  }

  /**
   * Check permissions for the active session
   */
  public static hasPermission(permission: Permission | string): boolean {
    const session = this.getSession();
    if (!session) return false;
    return hasPermission(session.role, permission as Permission);
  }

  /**
   * Check if active session can access a route path
   */
  public static canAccessPath(path: string): boolean {
    const session = this.getSession();
    if (!session) return path === '/login';
    return canAccessRoute(path, session.role);
  }
}

export * from './AuthContext';
