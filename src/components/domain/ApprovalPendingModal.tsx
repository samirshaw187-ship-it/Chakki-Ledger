import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, CheckCircle2, RefreshCw, X, Mail, User, ShieldAlert, Wifi } from 'lucide-react';
import { Button } from '../ui/Button';
import { dbRepository } from '../../db/in-memory-db';
import { AuthService } from '../../modules/auth';
import { FirestoreSyncService } from '../../services/firestore-sync.service';
import { User as UserType } from '../../types';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

export interface ApprovalPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingUser?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  onApprovedLogin?: (approvedUser: UserType) => void;
}

export const ApprovalPendingModal: React.FC<ApprovalPendingModalProps> = ({
  isOpen,
  onClose,
  pendingUser,
  onApprovedLogin,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [approvedUserData, setApprovedUserData] = useState<UserType | null>(null);
  const [checkStatusMessage, setCheckStatusMessage] = useState<{
    type: 'pending' | 'approved' | 'rejected' | 'error';
    text: string;
  } | null>(null);

  // Set up real-time listener for status updates (Local DB + Firestore when enabled)
  useEffect(() => {
    if (!isOpen || !pendingUser?.email) return;

    const cleanEmail = pendingUser.email.trim().toLowerCase();

    const checkLocalStatus = () => {
      const localUser = dbRepository.getUserByEmail(cleanEmail);
      if (localUser && localUser.isApproved && localUser.approvalStatus === 'APPROVED') {
        setApprovedUserData(localUser);
        setCheckStatusMessage({
          type: 'approved',
          text: 'Great news! Your account has been approved by the Administrator. You can now access your Chakki Ledger.',
        });
      } else if (localUser && localUser.approvalStatus === 'REJECTED') {
        setCheckStatusMessage({
          type: 'rejected',
          text: 'Your registration request was reviewed and rejected by the Administrator.',
        });
      }
    };

    // 1. Immediate local check & local subscription
    checkLocalStatus();
    const unsubLocal = dbRepository.subscribe(checkLocalStatus);

    // 2. Real-time Firestore document listener only if Firebase is connected
    let unsubFirestore: (() => void) | undefined;
    if (FirestoreSyncService.isFirebaseEnabled()) {
      try {
        if (pendingUser.id) {
          const userDocRef = doc(db, 'users', pendingUser.id);
          unsubFirestore = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserType;
              dbRepository.updateUser(data.id, data);
              if (data.isApproved && data.approvalStatus === 'APPROVED') {
                setApprovedUserData(data);
                setCheckStatusMessage({
                  type: 'approved',
                  text: 'Great news! Your account has been approved by the Administrator. You can now access your Chakki Ledger.',
                });
              } else if (data.approvalStatus === 'REJECTED') {
                setCheckStatusMessage({
                  type: 'rejected',
                  text: 'Your registration request was reviewed and rejected by the Administrator.',
                });
              }
            }
          });
        } else {
          const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
          unsubFirestore = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              const data = snap.docs[0].data() as UserType;
              dbRepository.addUser(data);
              if (data.isApproved && data.approvalStatus === 'APPROVED') {
                setApprovedUserData(data);
                setCheckStatusMessage({
                  type: 'approved',
                  text: 'Great news! Your account has been approved by the Administrator. You can now access your Chakki Ledger.',
                });
              } else if (data.approvalStatus === 'REJECTED') {
                setCheckStatusMessage({
                  type: 'rejected',
                  text: 'Your registration request was reviewed and rejected by the Administrator.',
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('Real-time listener setup note in ApprovalPendingModal:', err);
      }
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }, [isOpen, pendingUser]);

  if (!isOpen) return null;

  const handleCheckStatus = async () => {
    if (!pendingUser?.email) {
      setCheckStatusMessage({ type: 'error', text: 'No user email found to check.' });
      return;
    }

    setIsChecking(true);
    setCheckStatusMessage(null);

    try {
      const cleanEmail = pendingUser.email.trim().toLowerCase();
      // Fetch latest directly from Cloud Firestore
      let updatedUser: UserType | null = null;
      if (pendingUser.id) {
        updatedUser = await FirestoreSyncService.fetchUserById(pendingUser.id);
      }
      if (!updatedUser) {
        updatedUser = await FirestoreSyncService.fetchUserByEmail(cleanEmail);
      }
      if (!updatedUser) {
        updatedUser = dbRepository.getUserByEmail(cleanEmail) || null;
      }

      if (!updatedUser) {
        setCheckStatusMessage({
          type: 'error',
          text: 'Account not found in Cloud Firestore. Please re-register or verify email.',
        });
        return;
      }

      // Sync into local repository
      dbRepository.updateUser(updatedUser.id, updatedUser);

      if (updatedUser.isApproved && updatedUser.approvalStatus === 'APPROVED') {
        setApprovedUserData(updatedUser);
        setCheckStatusMessage({
          type: 'approved',
          text: 'Great news! Your account has been approved by the Administrator. You can now access your Chakki Ledger.',
        });
      } else if (updatedUser.approvalStatus === 'REJECTED') {
        setCheckStatusMessage({
          type: 'rejected',
          text: 'Your registration request was reviewed and rejected by the Administrator.',
        });
      } else {
        setCheckStatusMessage({
          type: 'pending',
          text: 'Your request is currently awaiting Administrator review in Firebase Firestore. Please check back shortly.',
        });
      }
    } catch {
      setCheckStatusMessage({
        type: 'error',
        text: 'Unable to verify status. Please try again or contact the administrator.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleProceedLogin = () => {
    const userToLogin = approvedUserData || (pendingUser?.email ? dbRepository.getUserByEmail(pendingUser.email.trim().toLowerCase()) : null);
    if (userToLogin && userToLogin.isApproved) {
      AuthService.establishSessionForUser(userToLogin);
      if (onApprovedLogin) {
        onApprovedLogin(userToLogin);
      }
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pending-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 space-y-5 text-stone-900">
        {/* Top Icon and Close Button */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shadow-xs">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Polished Title & Primary Sentence */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-block">
            Access Authorization Required
          </span>
          <h2 id="modal-pending-title" className="text-xl font-bold text-stone-900 tracking-tight">
            Request Sent Successfully
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal pt-1">
            Your registration request has been submitted. Please wait for Administrator approval before accessing your portal. Thank you for your patience.
          </p>
        </div>

        {/* Account Details Box */}
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
            <span className="text-stone-500 font-medium">Approval Status</span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-900 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full text-[11px]">
              <Clock className="w-3 h-3" /> Awaiting Admin Review
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Applicant Name:</span>
              <span className="font-semibold text-stone-800 flex items-center gap-1">
                <User className="w-3 h-3 text-stone-400" />
                {pendingUser?.name || 'Shop Owner'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-500">Registered Email:</span>
              <span className="font-mono text-stone-800 flex items-center gap-1 truncate max-w-[200px]">
                <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                {pendingUser?.email || '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-500">Account Role:</span>
              <span className="font-semibold text-emerald-900">Chakki Shop Owner</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-500">Administrator:</span>
              <span className="font-semibold text-stone-700">Samir (Admin)</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 text-[11px]">
              <span className="text-stone-500">Real-Time Sync:</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {FirestoreSyncService.isFirebaseEnabled() ? 'Firestore Live Listener Active' : 'Standalone Local Engine Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Informative Guidance */}
        {checkStatusMessage?.type !== 'approved' && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-[11px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">How approval works:</span> The System Administrator (<span className="font-mono text-stone-700">samirpc187@gmail.com</span>) can approve your account from the Admin Portal &gt; Users tab. When approved, this screen will automatically update!
          </div>
        )}

        {/* Dynamic Status Feedback */}
        {checkStatusMessage && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-150 ${
              checkStatusMessage.type === 'approved'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : checkStatusMessage.type === 'rejected'
                ? 'bg-red-50 border-red-300 text-red-900'
                : checkStatusMessage.type === 'error'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-stone-100 border-stone-200 text-stone-700'
            }`}
          >
            {checkStatusMessage.type === 'approved' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : checkStatusMessage.type === 'rejected' ? (
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{checkStatusMessage.text}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          {checkStatusMessage?.type === 'approved' ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleProceedLogin}
              className="w-full flex items-center justify-center gap-2 py-2.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Enter Chakki Ledger Now
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-stone-700 hover:bg-stone-50 border-stone-300 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking Approval Status...' : 'Check Approval Status'}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs py-2 cursor-pointer"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};
