import React, { useState, useEffect } from 'react';
import { UserRole, User as UserType } from '../types';
import { Button } from '../components/ui/Button';
import { ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Lock, User as UserIcon, Phone, Clock, LogOut } from 'lucide-react';
import { AuthService, validateGmail, validatePassword } from '../modules/auth';
import { ApprovalPendingModal } from '../components/domain/ApprovalPendingModal';

export interface LoginViewProps {
  onLoginSuccess: (role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state - clean slate without prototype credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.OWNER);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Approval Pending Modal state
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<{
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null>(null);

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailValidation = validateGmail(email);
    if (!emailValidation.isValid) {
      setErrorMessage(emailValidation.error || 'Email must contain @gmail.com at the end.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.login(email, password);
      if (result.success && result.session) {
        onLoginSuccess(result.session.role);
      } else if (result.isPendingApproval) {
        setPendingUser(result.pendingUser || { email });
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
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
        role: regRole,
      });

      if (result.success) {
        if (result.isPendingApproval) {
          // Shop Owner awaiting Admin approval
          setPendingUser(
            result.pendingUser || {
              name: regName,
              email: regEmail,
              phone: regPhone,
            }
          );
          setEmail(regEmail.trim().toLowerCase());
          setPassword('');
          setIsPendingModalOpen(true);
        } else {
          // Admin account created
          setSuccessMessage(result.message || 'Admin account successfully created!');
          setEmail(regEmail.trim().toLowerCase());
          setPassword(regPassword);
          setMode('login');
        }
      } else {
        setErrorMessage(result.error || 'Failed to create account.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      const result = await AuthService.signInWithGoogle();
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

  const handleGoogleSignOut = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await AuthService.logout();
      setSuccessMessage('Successfully signed out of Google / Firebase session.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign out.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-md p-6 space-y-5">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center mx-auto font-bold text-lg shadow-xs">
            CL
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Chakki Ledger</h1>
          <p className="text-xs text-stone-500">
            {mode === 'login' ? 'Owner & Administrator Secure Portal' : 'Create New User Account'}
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
          <button
            type="button"
            id="tab-sign-in"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-create-account"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{errorMessage}</span>
              {errorMessage.includes('Create Account') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setRegEmail(email);
                    setErrorMessage(null);
                  }}
                  className="block mt-1 font-semibold text-red-900 underline hover:text-red-950 cursor-pointer"
                >
                  Click here to Create Account now &rarr;
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

        {/* MODE 1: SIGN IN */}
        {mode === 'login' && (
          <div className="space-y-4">
            {/* Clean Credentials Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
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
                    id="input-login-email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? (
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
                    type={showPassword ? 'text' : 'password'}
                    id="input-login-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                id="btn-login-submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full justify-center shadow-xs"
              >
                Sign In with Password
              </Button>
            </form>

            {/* Google Authentication Section */}
            <div className="space-y-2.5 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-2.5 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Or Sign In / Out With
                </span>
                <div className="border-t border-stone-200 w-full" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-google-signin"
                  onClick={handleGoogleSignIn}
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
                  <span>Sign in with Google</span>
                </button>

                <button
                  type="button"
                  id="btn-google-signout"
                  onClick={handleGoogleSignOut}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-800 transition-colors cursor-pointer"
                  title="Sign out of Firebase / Google authentication"
                >
                  <LogOut className="w-3.5 h-3.5 text-stone-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>

            {/* Switch to Create Account */}
            <div className="text-center pt-2 text-xs text-stone-600">
              New to Chakki Ledger?{' '}
              <button
                type="button"
                id="link-go-to-register"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Create an Account
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: CREATE ACCOUNT */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {/* Admin Approval Notice Banner */}
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Important Approval Rule:</strong> When a Shop Owner creates an account, Administrator approval (Samir Shaw) is mandatory before access is unlocked.
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
                  id="input-reg-name"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Gmail */}
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
                  id="input-reg-email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
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
                  id="input-reg-phone"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="98300XXXXX"
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-reg-role-owner"
                  onClick={() => setRegRole(UserRole.OWNER)}
                  className={`p-2 rounded-xl text-left border cursor-pointer transition-all ${
                    regRole === UserRole.OWNER
                      ? 'border-emerald-700 bg-emerald-50/50 text-emerald-950 font-semibold'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-xs">Shop Owner</div>
                  <div className="text-[10px] text-stone-500 font-normal">Counter & Grinding</div>
                </button>
                <button
                  type="button"
                  id="btn-reg-role-admin"
                  onClick={() => setRegRole(UserRole.ADMIN)}
                  className={`p-2 rounded-xl text-left border cursor-pointer transition-all ${
                    regRole === UserRole.ADMIN
                      ? 'border-emerald-700 bg-emerald-50/50 text-emerald-950 font-semibold'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-xs">Administrator</div>
                  <div className="text-[10px] text-stone-500 font-normal">Back-office & Audits</div>
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700">
                  Password
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
                  id="input-reg-password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 8 chars, Aa1@"
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>

            <Button
              type="submit"
              id="btn-reg-submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full justify-center shadow-xs"
            >
              Create Account
            </Button>

            {/* Google Sign Up Alternative */}
            <div className="space-y-2 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Or Sign Up With
                </span>
                <div className="border-t border-stone-200 w-full" />
              </div>

              <button
                type="button"
                id="btn-google-signup"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs hover:border-stone-300 disabled:opacity-50"
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
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="text-center pt-2 text-xs text-stone-600">
              Already have an account?{' '}
              <button
                type="button"
                id="link-go-to-login"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* Security & Audit Assurance */}
        <div className="pt-2 border-t border-stone-100 text-center text-stone-500 text-[11px]">
          <span className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Connected to Cloud Firestore & Firebase Auth
          </span>
        </div>
      </div>

      {/* Approval Pending Modal */}
      <ApprovalPendingModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        pendingUser={pendingUser}
        onApprovedLogin={(approvedUser) => onLoginSuccess(approvedUser.role)}
      />
    </div>
  );
};
