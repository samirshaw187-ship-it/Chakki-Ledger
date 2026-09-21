import React, { useState } from 'react';
import { UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  Shield,
  Store,
} from 'lucide-react';
import {
  AuthService,
  isValidGmail,
  isValidPassword,
  ROLE_METADATA,
} from '../modules/auth';

export interface LoginViewProps {
  onLoginSuccess: (role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  // Mode: 'LOGIN' or 'REGISTER'
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Role selection: Shop Owner or Admin
  const [selectedRole, setSelectedRole] = useState<UserRole.OWNER | UserRole.ADMIN>(
    UserRole.OWNER
  );

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Registration Form State (Shop Owner)
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegLoading, setIsRegLoading] = useState(false);

  // Success Modal for Application Under Review
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Google Sign-In Selection Modal
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleTarget, setGoogleTarget] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [googleInputEmail, setGoogleInputEmail] = useState('');
  const [googleInputName, setGoogleInputName] = useState('');

  // Switch role
  const handleRoleChange = (role: UserRole.OWNER | UserRole.ADMIN) => {
    setSelectedRole(role);
    setLoginError(null);
    if (role === UserRole.ADMIN) {
      setLoginEmail('samirpc187@gmail.com');
      setLoginPassword('samirCL@2025');
    } else {
      setLoginEmail('');
      setLoginPassword('');
    }
  };

  // Password requirement analysis
  const passwordAnalysis = isValidPassword(
    activeTab === 'LOGIN' ? loginPassword : regPassword
  );

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setLoginError('Please enter your email address.');
      return;
    }

    if (!isValidGmail(cleanEmail)) {
      setLoginError('Email format must end with @gmail.com (e.g. yourname@gmail.com)');
      return;
    }

    const passReqs = isValidPassword(loginPassword);
    if (!passReqs.isValid) {
      setLoginError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol.'
      );
      return;
    }

    setIsLoginLoading(true);

    try {
      const result = await AuthService.loginWithEmailPassword(
        cleanEmail,
        loginPassword,
        selectedRole
      );

      if (result.success && result.session) {
        onLoginSuccess(result.session.role);
      } else {
        setLoginError(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'An unexpected error occurred during sign in.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Handle Shop Owner Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const cleanName = regName.trim();
    const cleanPhone = regPhone.trim().replace(/\D/g, '');
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanAddress = regAddress.trim();

    if (!cleanName) {
      setRegError('Please enter your full name.');
      return;
    }

    if (cleanPhone.length !== 10) {
      setRegError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!isValidGmail(cleanEmail)) {
      setRegError('Email format must be a valid @gmail.com address (e.g. name@gmail.com).');
      return;
    }

    if (!cleanAddress) {
      setRegError('Please provide your shop / chakki physical address.');
      return;
    }

    const passReqs = isValidPassword(regPassword);
    if (!passReqs.isValid) {
      setRegError(
        'Password must have at least one uppercase letter, one lowercase letter, one number, and one symbol.'
      );
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match. Please retype confirm password.');
      return;
    }

    setIsRegLoading(true);

    try {
      const result = await AuthService.registerShopOwner({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        address: cleanAddress,
        password: regPassword,
      });

      if (result.success && result.user) {
        setSubmittedEmail(cleanEmail);
        setIsReviewModalOpen(true);
      } else {
        setRegError(result.error || 'Failed to submit application. Please try again.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Error occurred while creating your account.');
    } finally {
      setIsRegLoading(false);
    }
  };

  // Google Login / Signup Handler
  const handleGoogleSelect = (email: string, name: string) => {
    setIsGoogleModalOpen(false);
    setLoginError(null);
    setRegError(null);

    if (googleTarget === 'REGISTER') {
      // Pre-fill registration fields
      setRegEmail(email);
      setRegName(name);
      return;
    }

    // Attempt login
    const result = AuthService.loginWithGoogle(email, selectedRole, name);
    if (result.success && result.session) {
      onLoginSuccess(result.session.role);
    } else {
      setLoginError(result.error || 'Google login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans antialiased text-stone-900">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden">
        {/* Top Header Branding */}
        <div className="bg-emerald-900 text-white p-6 pb-5 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                CL
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Chakki Ledger
                </h1>
                <p className="text-xs text-emerald-200">
                  Mill Ledger, Cash & Grain Settlement Platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-800/80 border border-emerald-700/60 rounded-full text-[11px] font-medium text-emerald-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Secure
            </div>
          </div>
        </div>

        {/* View Tabs: Sign In vs Create Account */}
        <div className="flex border-b border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setLoginError(null);
            }}
            className={`flex-1 py-3 text-center text-xs font-semibold cursor-pointer border-b-2 transition-all ${
              activeTab === 'LOGIN'
                ? 'border-emerald-700 text-emerald-800 bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setRegError(null);
            }}
            className={`flex-1 py-3 text-center text-xs font-semibold cursor-pointer border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'REGISTER'
                ? 'border-emerald-700 text-emerald-800 bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Create Shop Account
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ======================= TAB 1: SIGN IN ======================= */}
          {activeTab === 'LOGIN' && (
            <div className="space-y-4">
              {/* Role Selector: Shop Owner vs Admin */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">
                  Select User Account Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => handleRoleChange(UserRole.OWNER)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedRole === UserRole.OWNER
                        ? 'bg-white text-emerald-900 shadow-xs border border-stone-200/80'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5 text-emerald-700" />
                    Shop Owner
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange(UserRole.ADMIN)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedRole === UserRole.ADMIN
                        ? 'bg-white text-purple-900 shadow-xs border border-stone-200/80'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-700" />
                    Admin
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Admin Identity Banner */}
              {selectedRole === UserRole.ADMIN && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                      SS
                    </div>
                    <div>
                      <span className="font-semibold text-stone-900 block">Samir Shaw</span>
                      <span className="text-[11px] text-purple-800 font-mono">samirpc187@gmail.com</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('samirpc187@gmail.com');
                      setLoginPassword('samirCL@2025');
                    }}
                    className="px-2.5 py-1 bg-purple-700 text-white rounded-lg text-[11px] font-semibold hover:bg-purple-800 transition-colors cursor-pointer shadow-2xs"
                  >
                    Auto Fill
                  </button>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email Address <span className="text-emerald-700">(@gmail.com)</span>
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. gopal.sahu@gmail.com"
                      className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                  {loginEmail && !loginEmail.toLowerCase().endsWith('@gmail.com') && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Email format must end with @gmail.com
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showLoginPassword ? (
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
                    <Lock className="absolute left-3 w-4 h-4 text-stone-400" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>

                  {/* Password Requirements Guide */}
                  <div className="mt-2 p-2.5 bg-stone-50 rounded-lg border border-stone-100 text-[11px] text-stone-600 space-y-1">
                    <p className="font-semibold text-stone-700 mb-1">
                      Password Requirements:
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <span
                        className={`flex items-center gap-1 ${
                          passwordAnalysis.hasUppercase
                            ? 'text-emerald-700 font-medium'
                            : 'text-stone-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> 1 Uppercase (A-Z)
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          passwordAnalysis.hasLowercase
                            ? 'text-emerald-700 font-medium'
                            : 'text-stone-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> 1 Lowercase (a-z)
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          passwordAnalysis.hasNumber
                            ? 'text-emerald-700 font-medium'
                            : 'text-stone-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> 1 Number (0-9)
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          passwordAnalysis.hasSymbol
                            ? 'text-emerald-700 font-medium'
                            : 'text-stone-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> 1 Symbol (!@#$)
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoginLoading}
                  className="w-full justify-center shadow-xs"
                >
                  Sign In as {selectedRole === UserRole.ADMIN ? 'Admin' : 'Shop Owner'}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-stone-500 font-medium">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In Button at Bottom */}
              <button
                type="button"
                onClick={() => {
                  setGoogleTarget('LOGIN');
                  setIsGoogleModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-colors shadow-2xs cursor-pointer"
              >
                {/* Official Google 'G' Logo SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                Sign in with Google
              </button>

              {/* Link to Register */}
              <div className="pt-2 text-center text-xs text-stone-600">
                Are you a new chakki proprietor?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('REGISTER');
                    setRegError(null);
                  }}
                  className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  Create Shop Owner Account
                </button>
              </div>
            </div>
          )}

          {/* ======================= TAB 2: CREATE SHOP OWNER ACCOUNT ======================= */}
          {activeTab === 'REGISTER' && (
            <div className="space-y-4">
              <div className="border-b border-stone-100 pb-2">
                <h3 className="text-sm font-bold text-stone-900">
                  Shop Owner Registration
                </h3>
                <p className="text-xs text-stone-500">
                  Register your chakki mill to manage customer khatas and grain ledgers.
                </p>
              </div>

              {/* Error Notification */}
              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Ramesh Chandra Agrawal"
                      className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-stone-400 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full pl-11 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address <span className="text-emerald-700">(@gmail.com)</span>{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. ramesh.chakki@gmail.com"
                      className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                  {regEmail && !regEmail.toLowerCase().endsWith('@gmail.com') && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Must end with @gmail.com
                    </p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Shop / Chakki Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-start">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                    <textarea
                      rows={2}
                      required
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="e.g. Shop No. 4, Galla Mandi, Station Road, Kanpur"
                      className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showRegPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-stone-400" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="e.g. ShopOwner@2026#"
                      className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>

                  {/* Realtime password rule check */}
                  <div className="mt-1.5 p-2 bg-stone-50 rounded-lg border border-stone-100 text-[10px] text-stone-600 grid grid-cols-2 gap-1">
                    <span
                      className={`flex items-center gap-1 ${
                        passwordAnalysis.hasUppercase ? 'text-emerald-700 font-semibold' : 'text-stone-400'
                      }`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" /> 1 Uppercase (A-Z)
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        passwordAnalysis.hasLowercase ? 'text-emerald-700 font-semibold' : 'text-stone-400'
                      }`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" /> 1 Lowercase (a-z)
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        passwordAnalysis.hasNumber ? 'text-emerald-700 font-semibold' : 'text-stone-400'
                      }`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" /> 1 Number (0-9)
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        passwordAnalysis.hasSymbol ? 'text-emerald-700 font-semibold' : 'text-stone-400'
                      }`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" /> 1 Symbol (!@#$)
                    </span>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-stone-400" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Retype password"
                      className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {/* Submit: Confirm and Continue */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isRegLoading}
                  className="w-full justify-center shadow-xs mt-2"
                >
                  Confirm and Continue
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-stone-500 font-medium">Or</span>
                </div>
              </div>

              {/* Sign up with Google Option at Bottom */}
              <button
                type="button"
                onClick={() => {
                  setGoogleTarget('REGISTER');
                  setIsGoogleModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-colors shadow-2xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                Sign up with Google
              </button>

              <div className="text-center text-xs text-stone-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('LOGIN');
                    setLoginError(null);
                  }}
                  className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  Sign In here
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security & Audit Assurance */}
        <div className="py-3 px-6 bg-stone-50 border-t border-stone-200 text-center text-stone-500 text-[11px]">
          <span className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Audit-verified identity & encrypted credentials
          </span>
        </div>
      </div>

      {/* ======================= POLISHED UNDER REVIEW MODAL ======================= */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setActiveTab('LOGIN');
          setLoginEmail(submittedEmail);
          setLoginPassword('');
        }}
        title="Application Submitted Successfully"
        subtitle="Shop Owner Registration Pending Approval"
        maxWidth="md"
        footer={
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setIsReviewModalOpen(false);
              setActiveTab('LOGIN');
              setLoginEmail(submittedEmail);
              setLoginPassword('');
            }}
            className="w-full justify-center"
          >
            Return to Sign In
          </Button>
        }
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border-2 border-amber-300 shadow-xs">
            <Clock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h4 className="text-base font-bold text-stone-900">
              Your Application is Under Review
            </h4>
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 text-left leading-relaxed">
              <p className="font-semibold mb-1 text-amber-950">Status Notice:</p>
              <p>
                Your application for creating a Shop Owner account is currently under review.
                Please wait while our administrative team verifies your details. Once an
                Administrator approves your account, you will be able to access and use our
                platform.
              </p>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Registered Email:</span>
              <span className="font-mono font-semibold text-stone-900">{submittedEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Role Requested:</span>
              <span className="font-semibold text-emerald-800">Shop Owner (Proprietor)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Approval Channel:</span>
              <span className="text-stone-700">Platform Admin Verification</span>
            </div>
          </div>

          <p className="text-[11px] text-stone-500">
            Tip: You can switch to the Admin login or use the Admin panel to review and approve
            this new shop owner immediately!
          </p>
        </div>
      </Modal>

      {/* ======================= GOOGLE ACCOUNT PICKER MODAL ======================= */}
      <Modal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        title={googleTarget === 'LOGIN' ? 'Sign in with Google' : 'Sign up with Google'}
        subtitle="Authenticate using your Google (@gmail.com) account"
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-stone-500">
            Enter your Google email address to authenticate with Google Identity:
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (googleInputEmail) {
                handleGoogleSelect(
                  googleInputEmail.trim(),
                  googleInputName.trim() || googleInputEmail.split('@')[0]
                );
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Google Account Email <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  value={googleInputEmail}
                  onChange={(e) => setGoogleInputEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Name <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={googleInputName}
                  onChange={(e) => setGoogleInputName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center mt-2"
              disabled={!googleInputEmail.trim().endsWith('@gmail.com')}
            >
              Continue with Google
            </Button>
          </form>
        </div>
      </Modal>
    </div>
  );
};
