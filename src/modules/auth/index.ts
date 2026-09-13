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

    // Default development session: Gopal Sahu (Owner)
    const initialUser = dbRepository.getUsers().find((u) => u.role === UserRole.OWNER) || dbRepository.getUsers()[0];
    return {
      user: initialUser,
      token: `session_token_${initialUser.id}_${Date.now()}`,
      role: initialUser.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
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
    const expectedPin = user.pin || ROLE_METADATA[user.role]?.demoPin || '1234';
    if (cleanPin !== expectedPin) {
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
