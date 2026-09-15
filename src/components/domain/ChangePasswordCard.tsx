import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { AuthService, validatePassword } from '../../modules/auth';
import { useAuth } from '../../modules/auth/AuthContext';

export interface ChangePasswordCardProps {
  userId?: string;
  onSuccess?: () => void;
}

export const ChangePasswordCard: React.FC<ChangePasswordCardProps> = ({ userId, onSuccess }) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!targetUserId) {
      setErrorMessage('User session not identified.');
      return;
    }

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'New password does not meet security requirements.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.changePassword(targetUserId, currentPassword, newPassword);
      if (result.success) {
        setSuccessMessage('Password successfully updated and synchronized to Cloud Firestore!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(result.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while updating password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Change Account Password</h3>
            <p className="text-xs text-stone-500">
              Update your secure portal password and sync instantly to the cloud database
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Synced to Firestore
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-stone-700">
              Current Password
            </label>
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showCurrent ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showCurrent ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            type={showCurrent ? 'text' : 'password'}
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                New Password
              </label>
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 chars (Aa1@)"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Confirm New Password
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-stone-500">
            Password requires uppercase, lowercase, digit & symbol.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            className="shadow-2xs cursor-pointer"
          >
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
};
