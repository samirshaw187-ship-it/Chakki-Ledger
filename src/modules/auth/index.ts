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

export * from './permissions';

export function isValidGmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(clean);
}

export function isValidPassword(password: string): {
  isValid: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
} {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return {
    isValid: hasUppercase && hasLowercase && hasNumber && hasSymbol,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
  };
}

export interface AuthSession {
  user: User;
  token: string;
  role: UserRole;
  expiresAt: string;
}

export interface LoginResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

const SESSION_STORAGE_KEY = 'chakki_ledger_auth_session';

export class AuthService {
  private static listeners: Set<(session: AuthSession | null) => void> = new Set();

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

    // Start with no active session unless restored from sessionStorage
    return null;
  })();

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
   * Authenticate via Email (@gmail.com) and Password (uppercase, lowercase, number, symbol)
   * Backed by Firebase Authentication
   */
  public static async loginWithEmailPassword(
    email: string,
    password: string,
    expectedRole?: UserRole
  ): Promise<LoginResult> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address' };
    }

    if (!isValidGmail(cleanEmail)) {
      return { success: false, error: 'Email format must end with @gmail.com (e.g. name@gmail.com)' };
    }

    const passCheck = isValidPassword(password);
    if (!passCheck.isValid) {
      return {
        success: false,
        error: 'Password must include at least one uppercase letter, one lowercase letter, one number, and one symbol.',
      };
    }

    // Try Firebase Authentication
    try {
      const { FirebaseAuthService } = await import('../../services/firebase-auth.service');
      const fbResult = await FirebaseAuthService.signIn(cleanEmail, password, expectedRole);
      if (fbResult.success && fbResult.session) {
        this.saveSession(fbResult.session);
        return fbResult;
      }
      if (fbResult.error) {
        return fbResult;
      }
    } catch (e: any) {
      console.warn('Firebase Auth primary sign-in notice, checking local records:', e?.message);
    }

    const user = dbRepository.getUserByEmail(cleanEmail);
    if (!user) {
      return { success: false, error: 'No account registered with this @gmail.com address.' };
    }

    // Check expected role if specified (e.g., Shop Owner vs Admin)
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
          error: 'This account is not a Shop Owner account. Please verify your role or select Admin.',
        };
      }
    }

    // Verify Password
    const expectedPassword = user.password || user.pin;
    if (password !== expectedPassword) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    // Check account status for Shop Owners
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
          error:
            'Your Shop Owner account has been temporarily suspended by the Administrator. Please contact support.',
        };
      }
      if (user.approvalStatus === 'DEACTIVATED' || !user.isActive) {
        return {
          success: false,
          error:
            'Your Shop Owner account has been deactivated. Please contact the administrator.',
        };
      }
    } else if (!user.isActive) {
      return {
        success: false,
        error: 'Account is deactivated. Please contact the administrator.',
      };
    }

    // Update last login timestamp
    dbRepository.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    const session: AuthSession = {
      user: { ...user, lastLoginAt: new Date().toISOString() },
      token: `token_${user.id}_${Date.now()}`,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.saveSession(session);

    // Audit log
    AuditService.log({
      action: AuditAction.LOGIN,
      entityType: 'AUTH',
      entityId: user.id,
      performedById: user.id,
      performedByName: user.name,
      reason: `User logged in via email (${user.role}: ${user.email})`,
    });

    return { success: true, session };
  }

  /**
   * Sign In with Google (Supports both Shop Owner and Admin)
   */
  public static async loginWithGoogle(
    googleEmail?: string,
    role: UserRole = UserRole.OWNER,
    userName?: string
  ): Promise<LoginResult & { isNewAccountNeeded?: boolean; googleUser?: { email: string; name: string; uid?: string } }> {
    try {
      const { FirebaseAuthService } = await import('../../services/firebase-auth.service');
      const result = await FirebaseAuthService.signInWithGoogle(role, googleEmail, userName);
      if (result.success && result.session) {
        this.saveSession(result.session);
      }
      return result;
    } catch (e: any) {
      console.warn('Firebase Google Auth error:', e);
      return { success: false, error: e?.message || 'Failed to authenticate with Google.' };
    }
  }

  /**
   * Register with Google (Shop Owner application)
   */
  public static async registerWithGoogle(data: {
    email?: string;
    name?: string;
    phone?: string;
    shopName?: string;
    address?: string;
    authUid?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const { FirebaseAuthService } = await import('../../services/firebase-auth.service');
      return await FirebaseAuthService.signUpWithGoogle(data);
    } catch (e: any) {
      console.warn('Firebase Google Registration error:', e);
      return { success: false, error: e?.message || 'Failed to register with Google.' };
    }
  }

  /**
   * Register a new Shop Owner application (subject to Admin review & approval)
   * Backed by Firebase Authentication
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

    // Try Firebase Authentication registration
    try {
      const { FirebaseAuthService } = await import('../../services/firebase-auth.service');
      const fbRegResult = await FirebaseAuthService.registerShopOwner({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        address: cleanAddress,
        password,
      });
      if (fbRegResult.success) {
        return fbRegResult;
      }
      if (fbRegResult.error) {
        return fbRegResult;
      }
    } catch (e: any) {
      console.warn('Firebase Auth registration notice, falling back to local store:', e?.message);
    }

    // Check if email already registered
    const existingByEmail = dbRepository.getUserByEmail(cleanEmail);
    if (existingByEmail) {
      return {
        success: false,
        error: `An account with ${cleanEmail} already exists. Please sign in or use a different email.`,
      };
    }

    // Check if phone already registered
    const existingByPhone = dbRepository.getUserByPhone(cleanPhone);
    if (existingByPhone) {
      return {
        success: false,
        error: `Mobile number +91 ${cleanPhone} is already registered (${existingByPhone.name}).`,
      };
    }

    // Create user in PENDING_APPROVAL status
    const newUser = dbRepository.addUser({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      address: cleanAddress,
      password: password,
      role: UserRole.OWNER,
      approvalStatus: 'PENDING_APPROVAL',
      isActive: false,
    });

    AuditService.log({
      action: AuditAction.CREATE,
      entityType: 'SHOP_OWNER_APPLICATION',
      entityId: newUser.id,
      performedById: newUser.id,
      performedByName: cleanName,
      reason: `New Shop Owner application submitted for Admin approval (${cleanEmail})`,
    });

    return { success: true, user: newUser };
  }

  /**
   * Authenticate via Phone Number and 4-digit PIN
   */
  public static login(phone: string, pin: string): LoginResult {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanPin = pin.trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }

    if (!cleanPin || cleanPin.length < 4) {
      return { success: false, error: 'Please enter your 4-digit PIN' };
    }

    const user = dbRepository.getUserByPhone(cleanPhone);
    if (!user) {
      return { success: false, error: 'No account registered with this mobile number' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Account is deactivated. Please contact the shop owner.' };
    }

    // Verify PIN
    const expectedPin = user.pin;
    if (!expectedPin || cleanPin !== expectedPin) {
      return { success: false, error: 'Incorrect PIN. Please try again.' };
    }

    // Update last login timestamp
    dbRepository.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    const session: AuthSession = {
      user: { ...user, lastLoginAt: new Date().toISOString() },
      token: `token_${user.id}_${Date.now()}`,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.saveSession(session);

    // Audit log
    AuditService.log({
      action: AuditAction.LOGIN,
      entityType: 'AUTH',
      entityId: user.id,
      performedById: user.id,
      performedByName: user.name,
      reason: `User logged in via mobile PIN (${user.role})`,
    });

    return { success: true, session };
  }

  /**
   * Fast 1-click role switch for development and demonstration
   */
  public static loginAsRole(role: UserRole): AuthSession | null {
    const users = dbRepository.getUsers();
    let user = users.find((u) => u.role === role && u.isActive);
    if (!user) {
      user = users.find((u) => u.role === role);
    }
    if (!user) {
      return null;
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
  public static switchRole(role: UserRole): AuthSession | null {
    return this.loginAsRole(role);
  }

  /**
   * Terminate current session
   */
  public static logout(): void {
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

    this.saveSession(null);

    // Synchronously/asynchronously ensure Firebase Auth is also signed out
    import('../../services/firebase-auth.service')
      .then(({ FirebaseAuthService }) => FirebaseAuthService.signOut())
      .catch((e) => console.warn('Firebase sign-out notice:', e));
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
