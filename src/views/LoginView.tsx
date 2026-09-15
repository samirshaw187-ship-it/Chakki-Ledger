import React, { useState, useEffect } from 'react';
import { UserRole, User as UserType } from '../types';
import { Button } from '../components/ui/Button';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  Clock,
  LogOut,
  Store,
  Shield,
  KeyRound,
  Check,
  X as XIcon,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { AuthService, validateGmail, validatePassword } from '../modules/auth';
import { ApprovalPendingModal } from '../components/domain/ApprovalPendingModal';
import { FirebaseSetupHelpModal } from '../components/domain/FirebaseSetupHelpModal';

export interface LoginViewProps {
  onLoginSuccess: (role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  // Primary Portal: 'owner' (Shop Owner) vs 'admin' (Administrator)
  const [portal, setPortal] = useState<'owner' | 'admin'>('owner');

  // Shop Owner sub-mode: 'login' | 'register' (Admin mode has NO register!)
  const [ownerMode, setOwnerMode] = useState<'login' | 'register'>('login');

  // Shop Owner Login Form State
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  // Shop Owner Register Form State (strictly for Shop Owners, NO Admin creation!)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Admin Login Form State (prefilled with official admin email for convenience)
  const [adminEmail, setAdminEmail] = useState('samirpc187@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Approval Pending Modal state
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [isFirebaseHelpOpen, setIsFirebaseHelpOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<{
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  // Real-time password validation helpers for register
  const hasMinLength = regPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(regPassword);
  const hasLowerCase = /[a-z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(regPassword);

  // Listen for background pending authorization triggers from auth state
  useEffect(() => {
    const unsub = AuthService.onPendingApproval((user: UserType) => {
      setPendingUser({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
      setIsPendingModalOpen(true);
    });
    return () => unsub();
  }, []);

  const handlePortalSwitch = (newPortal: 'owner' | 'admin') => {
    setPortal(newPortal);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // 1. SHOP OWNER LOGIN SUBMIT
  const handleOwnerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailValidation = validateGmail(ownerEmail);
    if (!emailValidation.isValid) {
      setErrorMessage(emailValidation.error || 'Email must contain @gmail.com at the end.');
      return;
    }

    if (!ownerPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.login(ownerEmail, ownerPassword, 'owner');
      if (result.success && result.session) {
        onLoginSuccess(result.session.role);
      } else if (result.isPendingApproval) {
        setPendingUser(result.pendingUser || { email: ownerEmail });
        setIsPendingModalOpen(true);
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. SHOP OWNER REGISTRATION SUBMIT
  // Exclusively registers Shop Owners; automatically sets approval status to PENDING
  const handleOwnerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const emailValidation = validateGmail(regEmail);
    if (!emailValidation.isValid) {
      setErrorMessage(emailValidation.error || 'Please enter a valid Gmail address ending in @gmail.com.');
      return;
    }

    const passwordValidation = validatePassword(regPassword);
    if (!passwordValidation.isValid) {
      setErrorMessage(passwordValidation.error || 'Password must meet all security requirements.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        role: UserRole.OWNER, // strictly Shop Owner
      });

      if (result.success) {
        // Shop Owner is queued for Admin approval
        setPendingUser(
          result.pendingUser || {
            name: regName,
            email: regEmail,
            phone: regPhone,
          }
        );
        setOwnerEmail(regEmail.trim().toLowerCase());
        setOwnerPassword('');
        setIsPendingModalOpen(true);
      } else {
        setErrorMessage(result.error || 'Failed to create account.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. ADMIN LOGIN SUBMIT
  // Strictly verifies administrator credentials for samirpc187@gmail.com
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailValidation = validateGmail(adminEmail);
    if (!emailValidation.isValid) {
      setErrorMessage(emailValidation.error || 'Admin email must be a valid @gmail.com address.');
      return;
    }

    if (!adminPassword) {
      setErrorMessage('Please enter the Administrator password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.login(adminEmail, adminPassword, 'admin');
      if (result.success && result.session) {
        onLoginSuccess(result.session.role);
      } else {
        setErrorMessage(result.error || 'Administrator verification failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during admin sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. GOOGLE SIGN IN (Handled appropriately per portal)
  const handleGoogleSignIn = async (targetPortal: 'owner' | 'admin') => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      const result = await AuthService.signInWithGoogle(targetPortal);
      if (result.success && result.session) {
        onLoginSuccess(result.session.role);
      } else if (result.isPendingApproval) {
        setPendingUser(result.pendingUser || null);
        setIsPendingModalOpen(true);
      } else {
        setErrorMessage(result.error || 'Google sign-in could not be completed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await AuthService.logout();
      setSuccessMessage('Successfully signed out of active session.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign out.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans selection:bg-emerald-100">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-md p-6 space-y-5">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center mx-auto font-bold text-lg shadow-xs">
            CL
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Chakki Ledger</h1>
          <p className="text-xs text-stone-500">
            {portal === 'owner'
              ? 'Shop Owner Counter & Business Operations'
              : 'Restricted System Administrator Gateway'}
          </p>
        </div>

        {/* PRIMARY PORTAL SEPARATOR: Shop Owner vs Administrator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 px-0.5">
            <span>Select Access Portal:</span>
            <span className="text-[10px] text-stone-400">Separate Portals</span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-xl border border-stone-200">
            <button
              type="button"
              id="portal-shop-owner"
              onClick={() => handlePortalSwitch('owner')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                portal === 'owner'
                  ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Store className="w-4 h-4 text-emerald-700" />
              <span>Shop Owner</span>
            </button>

            <button
              type="button"
              id="portal-admin"
              onClick={() => handlePortalSwitch('admin')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                portal === 'admin'
                  ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              <span>Administrator</span>
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span>{errorMessage}</span>
              {portal === 'owner' && errorMessage.includes('Create Account') && (
                <button
                  type="button"
                  onClick={() => {
                    setOwnerMode('register');
                    setRegEmail(ownerEmail);
                    setErrorMessage(null);
                  }}
                  className="block font-semibold text-red-900 underline hover:text-red-950 cursor-pointer"
                >
                  Click here to Register Shop Owner Account &rarr;
                </button>
              )}
              {(errorMessage.includes('domain') ||
                errorMessage.includes('Authorized domains') ||
                errorMessage.includes('Email/Password') ||
                errorMessage.includes('Firebase') ||
                errorMessage.includes('sign-in is disabled')) && (
                <button
                  type="button"
                  onClick={() => setIsFirebaseHelpOpen(true)}
                  className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 font-semibold rounded-md border border-red-300 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Review Firebase Setup &amp; Authorized Domains Guide</span>
                </button>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PORTAL 1: SHOP OWNER PORTAL                                               */}
        {/* Allows Sign In, Sign Out, and Create Account (Requires Admin Approval)     */}
        {/* ========================================================================= */}
        {portal === 'owner' && (
          <div className="space-y-4">
            {/* Sub-tabs: Sign In vs Create Account */}
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                type="button"
                id="owner-tab-signin"
                onClick={() => {
                  setOwnerMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  ownerMode === 'login'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="owner-tab-create-account"
                onClick={() => {
                  setOwnerMode('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  ownerMode === 'register'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* SHOP OWNER: SIGN IN TAB */}
            {ownerMode === 'login' && (
              <div className="space-y-4">
                <form onSubmit={handleOwnerLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Shop Owner Gmail
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-stone-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        id="input-owner-email"
                        required
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="e.g. yourshop@gmail.com"
                        className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-stone-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {showOwnerPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> Show
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-stone-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showOwnerPassword ? 'text' : 'password'}
                        id="input-owner-password"
                        required
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    id="btn-owner-login"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full justify-center shadow-xs"
                  >
                    Sign In as Shop Owner
                  </Button>
                </form>

                {/* Google Sign In & Sign Out for Shop Owner */}
                <div className="space-y-2.5 pt-1">
                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-stone-200 w-full" />
                    <span className="bg-white px-2 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      Or Sign In / Out With
                    </span>
                    <div className="border-t border-stone-200 w-full" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="btn-owner-google-signin"
                      onClick={() => handleGoogleSignIn('owner')}
                      disabled={isGoogleLoading}
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs hover:border-stone-300 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Google Sign In</span>
                    </button>

                    <button
                      type="button"
                      id="btn-owner-signout"
                      onClick={handleSignOut}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-800 transition-colors cursor-pointer"
                      title="Sign out of current active session"
                    >
                      <LogOut className="w-3.5 h-3.5 text-stone-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>

                <div className="text-center pt-2 text-xs text-stone-600">
                  New Shop Owner?{' '}
                  <button
                    type="button"
                    id="link-go-to-owner-register"
                    onClick={() => {
                      setOwnerMode('register');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Create Account &amp; Request Approval
                  </button>
                </div>
              </div>
            )}

            {/* SHOP OWNER: CREATE ACCOUNT TAB */}
            {/* Strictly creates Shop Owner accounts. Admin approval is MANDATORY. */}
            {ownerMode === 'register' && (
              <form onSubmit={handleOwnerRegisterSubmit} className="space-y-3.5">
                {/* Mandatory Approval Notice */}
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Admin Approval Mandatory:</strong> When you register as a new Shop Owner, your account requires Administrator review (Samir Shaw) before you can access your shop ledger.
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-stone-400">
                      <UserIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      id="input-owner-reg-name"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {/* Gmail Address */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Gmail Address
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-stone-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      id="input-owner-reg-email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="yourshop@gmail.com"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Must end with <strong className="text-stone-700">@gmail.com</strong>
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-stone-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      id="input-owner-reg-phone"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="98300XXXXX"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {/* Fixed Assigned Role Badge (NO Admin Selection Permitted) */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Assigned Account Role
                  </label>
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-700" />
                      <div>
                        <span className="text-xs font-bold text-emerald-950">Chakki Shop Owner</span>
                        <p className="text-[10px] text-emerald-800">Counter, billing, grain grinding & khata management</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md">
                      Requires Approval
                    </span>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-700">
                      Create Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showRegPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Show
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-stone-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      id="input-owner-reg-password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 8 chars, Aa1@"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] text-stone-500">
                    <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-semibold' : ''}`}>
                      {hasMinLength ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3 text-stone-300" />} 8+ Characters
                    </span>
                    <span className={`flex items-center gap-1 ${hasSpecialChar ? 'text-emerald-700 font-semibold' : ''}`}>
                      {hasSpecialChar ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3 text-stone-300" />} 1 Special Char (@#$)
                    </span>
                    <span className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-700 font-semibold' : ''}`}>
                      {hasNumber ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3 text-stone-300" />} 1 Number (0-9)
                    </span>
                    <span className={`flex items-center gap-1 ${hasUpperCase && hasLowerCase ? 'text-emerald-700 font-semibold' : ''}`}>
                      {hasUpperCase && hasLowerCase ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3 text-stone-300" />} Upper &amp; Lowercase
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  id="btn-owner-reg-submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full justify-center shadow-xs"
                >
                  Submit Registration for Approval
                </Button>

                <div className="text-center pt-2 text-xs text-stone-600">
                  Already have an approved account?{' '}
                  <button
                    type="button"
                    id="link-go-to-owner-login"
                    onClick={() => {
                      setOwnerMode('login');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Sign In here
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PORTAL 2: ADMINISTRATOR PORTAL                                            */}
        {/* Strictly for Administrator (samirpc187@gmail.com).                        */}
        {/* Account registration / sign up is PERMANENTLY REMOVED for security.       */}
        {/* ========================================================================= */}
        {portal === 'admin' && (
          <div className="space-y-4">
            {/* Security Notice Banner */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5 text-xs text-indigo-900">
              <div className="flex items-center gap-2 font-bold text-indigo-950">
                <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0" />
                <span>Authorized Administrator Gateway</span>
              </div>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                The System Administrator is <strong>samirpc187@gmail.com</strong>.
                To safeguard financial integrity, <strong>admin account creation or sign up is permanently disabled</strong>.
              </p>
            </div>

            {/* Admin Login Form */}
            <form onSubmit={handleAdminLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Administrator Gmail Address
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-stone-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    id="input-admin-email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="samirpc187@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700/20 focus:border-indigo-700"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">
                    Administrator Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="text-[11px] font-medium text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showAdminPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Show
                      </>
                    )}
                  </button>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-stone-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    id="input-admin-password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700/20 focus:border-indigo-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                id="btn-admin-login"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full justify-center bg-indigo-800 hover:bg-indigo-900 text-white shadow-xs"
              >
                Sign In to Admin Console
              </Button>
            </form>

            {/* Admin Google Sign In Option (Restricted strictly to samirpc187@gmail.com) */}
            <div className="space-y-2.5 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Or Admin Authentication
                </span>
                <div className="border-t border-stone-200 w-full" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-admin-google-signin"
                  onClick={() => handleGoogleSignIn('admin')}
                  disabled={isGoogleLoading}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs hover:border-stone-300 disabled:opacity-50"
                  title="Sign in with Administrator Google Account (samirpc187@gmail.com)"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Admin Google Sign In</span>
                </button>

                <button
                  type="button"
                  id="btn-admin-signout"
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-800 transition-colors cursor-pointer"
                  title="Sign out of current active session"
                >
                  <LogOut className="w-3.5 h-3.5 text-stone-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Switch Back to Shop Owner Guidance */}
            <div className="text-center pt-2 text-xs text-stone-600">
              Not an Administrator?{' '}
              <button
                type="button"
                id="link-switch-to-owner-portal"
                onClick={() => handlePortalSwitch('owner')}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Go to Shop Owner Portal
              </button>
            </div>
          </div>
        )}

        {/* Security & Cloud Firestore Assurance */}
        <div className="pt-2 border-t border-stone-100 flex flex-col items-center gap-1.5 text-center text-stone-500 text-[11px]">
          <span className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Connected to Cloud Firestore &amp; Firebase Auth
          </span>
          <button
            type="button"
            onClick={() => setIsFirebaseHelpOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 hover:underline cursor-pointer"
          >
            <Globe className="w-3 h-3" />
            <span>Firebase Settings &amp; Authorized Domains</span>
          </button>
        </div>
      </div>

      {/* Approval Pending Modal */}
      <ApprovalPendingModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        pendingUser={pendingUser}
        onApprovedLogin={(approvedUser) => onLoginSuccess(approvedUser.role)}
      />

      {/* Firebase Setup & Authorized Domains Guide Modal */}
      <FirebaseSetupHelpModal
        isOpen={isFirebaseHelpOpen}
        onClose={() => setIsFirebaseHelpOpen(false)}
        initialError={errorMessage}
      />
    </div>
  );
};
