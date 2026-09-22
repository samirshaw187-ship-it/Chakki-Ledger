/**
 * Chakki Ledger - AuthContext & useAuth Hook
 *
 * Provides reactive, application-wide authentication and authorization state.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../../types';
import { AuthService, AuthSession, LoginResult } from './index';
import { Permission, hasPermission, canAccessRoute } from './permissions';

export interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  role: UserRole;
  isAuthenticated: boolean;
  login: (phone: string, pin: string) => Promise<LoginResult>;
  loginWithEmailPassword: (email: string, password: string, role?: UserRole) => Promise<LoginResult>;
  loginWithGoogle: (email: string, role?: UserRole, name?: string) => Promise<LoginResult>;
  loginAsRole: (role: UserRole) => void;
  logout: () => void;
  can: (permission: Permission) => boolean;
  canAccessPath: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getSession());

  useEffect(() => {
    // Subscribe to AuthService changes (persisted logins, logouts, switches)
    const unsubscribe = AuthService.subscribe((updatedSession) => {
      setSession(updatedSession);
    });
    return unsubscribe;
  }, []);

  const login = async (phone: string, pin: string): Promise<LoginResult> => {
    const result = AuthService.login(phone, pin);
    if (result.success && result.session) {
      setSession(result.session);
    }
    return result;
  };

  const loginWithEmailPassword = async (
    email: string,
    password: string,
    role?: UserRole
  ): Promise<LoginResult> => {
    const result = await AuthService.loginWithEmailPassword(email, password, role);
    if (result.success && result.session) {
      setSession(result.session);
    }
    return result;
  };

  const loginWithGoogle = async (
    email: string,
    role?: UserRole,
    name?: string
  ): Promise<LoginResult> => {
    const result = await AuthService.loginWithGoogle(email, role, name);
    if (result.success && result.session) {
      setSession(result.session);
    }
    return result;
  };

  const loginAsRole = (role: UserRole) => {
    const newSession = AuthService.loginAsRole(role);
    setSession(newSession);
  };

  const logout = () => {
    AuthService.logout();
    setSession(null);
  };

  const role = session?.role || UserRole.OWNER;
  const user = session?.user || null;
  const isAuthenticated = session !== null;

  const can = useMemo(() => {
    return (permission: Permission) => {
      if (!session) return false;
      return hasPermission(session.role, permission);
    };
  }, [session]);

  const canAccess = useMemo(() => {
    return (path: string) => {
      if (!session) return path === '/login';
      return canAccessRoute(path, session.role);
    };
  }, [session]);

  const value: AuthContextType = {
    user,
    session,
    role,
    isAuthenticated,
    login,
    loginWithEmailPassword,
    loginWithGoogle,
    loginAsRole,
    logout,
    can,
    canAccessPath: canAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
