import React, { useState } from 'react';
import { UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, Smartphone, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import { AuthService, ROLE_METADATA } from '../modules/auth';
import { dbRepository } from '../db/in-memory-db';

export interface LoginViewProps {
  onLoginSuccess: (role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('9830012345'); // Default pre-filled with Owner for easy testing
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const users = dbRepository.getUsers();

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = AuthService.login(phone, pin);
      if (result.success && result.session) {
        onLoginSuccess(result.session.role);
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please check your details.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (userPhone: string, userPin: string, role: UserRole) => {
    setPhone(userPhone);
    setPin(userPin);
    setErrorMessage(null);

    // Instant login for demo convenience
    const result = AuthService.login(userPhone, userPin);
    if (result.success && result.session) {
      onLoginSuccess(result.session.role);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 shadow-md p-6 space-y-5">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center mx-auto font-bold text-lg shadow-xs">
            CL
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Chakki Ledger</h1>
          <p className="text-xs text-stone-500">Counter Operator & Back-Office Sign In</p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Mobile Number
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
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9830012345"
                className="w-full pl-11 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Security PIN
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showPin ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Hide PIN
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Show PIN
                  </>
                )}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-base tracking-widest font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full justify-center shadow-xs"
          >
            Sign In to Counter
          </Button>
        </form>

        {/* Quick Demo Test Accounts Section */}
        <div className="pt-3 border-t border-stone-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Quick Test Profiles
            </span>
            <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
              1-Tap Enter
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {users.map((u) => {
              const meta = ROLE_METADATA[u.role];
              const demoPin = u.pin || meta.demoPin;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickFill(u.phone, demoPin, u.role)}
                  className="w-full p-2.5 rounded-xl border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50/40 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-stone-900 truncate">{u.name}</p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      +91 {u.phone} • PIN: <span className="font-semibold text-stone-700">{demoPin}</span>
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 border ${meta.badgeClass}`}
                  >
                    {u.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Security & Audit Assurance */}
        <div className="pt-2 border-t border-stone-100 text-center text-stone-500 text-[11px]">
          <span className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Audit-logged non-destructive session
          </span>
        </div>
      </div>
    </div>
  );
};
