import React, { useState } from 'react';
import {
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  Globe,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  X,
  Layers,
  AlertTriangle,
  Info
} from 'lucide-react';
import { getDocFromServer, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface FirebaseSetupHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: string | null;
}

export const FirebaseSetupHelpModal: React.FC<FirebaseSetupHelpModalProps> = ({
  isOpen,
  onClose,
  initialError,
}) => {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'warning'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  if (!isOpen) return null;

  const requiredDomains = [
    { domain: currentHostname, label: 'Current Applet Domain (Active Container)', priority: true },
    { domain: 'chakki-ledger.firebaseapp.com', label: 'Default Firebase Auth Domain' },
    { domain: 'protean-notch-1fs6l.firebaseapp.com', label: 'Provisioned Firebase Auth Domain' },
    { domain: 'chakki-ledger.web.app', label: 'Firebase Web App Hosting' },
    { domain: 'localhost', label: 'Local Development' },
    { domain: 'ais-dev-5ysaerbqi7rsuiagdg7j5c-413397232898.asia-east1.run.app', label: 'Cloud Run Dev Host' },
    { domain: 'ais-pre-5ysaerbqi7rsuiagdg7j5c-413397232898.asia-east1.run.app', label: 'Cloud Run Preview Host' },
    { domain: 'vercel.app', label: 'Vercel Deployment (Wildcard / your-app.vercel.app)' },
  ];

  // Deduplicate domains in case currentHostname is already in the list
  const uniqueDomains = Array.from(
    new Map(requiredDomains.map((item) => [item.domain, item])).values()
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDomain(text);
    setTimeout(() => setCopiedDomain(null), 2500);
  };

  const handleCopyAll = () => {
    const allText = uniqueDomains.map((d) => d.domain).join('\n');
    handleCopy(allText);
  };

  const runDiagnostics = async () => {
    setTestStatus('testing');
    setTestMessage('Verifying connection to Firestore and Firebase services...');
    try {
      // Test server connection to Firestore
      await getDocFromServer(doc(db, 'settings', 'connectivity_test'));
      setTestStatus('success');
      setTestMessage('Successfully connected to Firestore database (ai-studio-chakkiledger)!');
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        setTestStatus('warning');
        setTestMessage('Firestore connected, but access rules require authentication or specific permissions.');
      } else if (err.code === 'not-found' || err.message?.includes('No document to update')) {
        setTestStatus('success');
        setTestMessage('Firestore server responded successfully (endpoint reachable).');
      } else {
        setTestStatus('warning');
        setTestMessage(`Diagnostics note: ${err.message || err.code || 'Check network connection'}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Firebase Configuration & Domains Guide</h2>
              <p className="text-xs text-stone-500">Project: chakki-ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-stone-700">
          {/* Error Banner if triggered from a failed attempt */}
          {initialError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-900">Triggered by Authentication Notice:</p>
                <p className="text-xs text-amber-800 font-mono break-all">{initialError}</p>
              </div>
            </div>
          )}

          {/* Section 1: Authorized Domains Restoration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h3 className="font-semibold text-stone-900">Authorized Domains Checklist</h3>
              </div>
              <button
                type="button"
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-md border border-stone-300 font-medium transition-colors"
              >
                {copiedDomain?.includes('\n') ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied All!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy All Domains
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              If authorized domains were deleted, Firebase blocks registration, login, and Google Sign-In with an 
              <code className="bg-stone-100 px-1 py-0.5 rounded text-amber-800 font-mono text-[11px] mx-1">
                auth/unauthorized-domain
              </code> 
              error. Ensure these domains are listed under your Firebase settings:
            </p>

            {/* Domains List */}
            <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 bg-stone-50">
              {uniqueDomains.map((item) => (
                <div
                  key={item.domain}
                  className={`p-2.5 flex items-center justify-between gap-3 text-xs ${
                    item.priority ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600 font-medium' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-stone-900 select-all font-semibold">{item.domain}</span>
                      {item.priority && (
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Active Current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 truncate">{item.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.domain)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200 transition-colors shrink-0"
                    title={`Copy ${item.domain}`}
                  >
                    {copiedDomain === item.domain ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Direct Link to Firebase Authorized Domains */}
            <div className="pt-1">
              <a
                href="https://console.firebase.google.com/project/chakki-ledger/authentication/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                <span>Open Firebase Authorized Domains Settings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="text-[11px] text-stone-500 text-center mt-1">
                Steps: Authentication → Settings tab → Authorized domains → Click &ldquo;Add domain&rdquo; → Paste domain → Save
              </p>
            </div>
          </div>

          {/* Section 2: Enable Email/Password Provider */}
          <div className="space-y-3 pt-4 border-t border-stone-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h3 className="font-semibold text-stone-900">Enable Email/Password Sign-In Provider</h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              If newly created Shop Owner accounts are not appearing in Firebase under the &ldquo;Users&rdquo; tab, the 
              <strong> Email/Password </strong> sign-in method is currently disabled in your Firebase project.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>How to enable in 2 clicks:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 text-[12px] pl-1">
                <li>Go to <strong>Authentication</strong> → <strong>Sign-in method</strong> tab</li>
                <li>Click on <strong>Email/Password</strong> provider</li>
                <li>Switch the first toggle <strong>&ldquo;Enable&rdquo;</strong> to ON</li>
                <li>Click <strong>Save</strong></li>
              </ol>
            </div>

            <a
              href="https://console.firebase.google.com/project/chakki-ledger/authentication/providers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 bg-blue-700 text-white rounded-xl text-xs font-semibold hover:bg-blue-800 transition-colors"
            >
              <span>Open Firebase Sign-In Method Settings</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Section 3: Connectivity & Diagnostics */}
          <div className="space-y-3 pt-4 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-800 flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h3 className="font-semibold text-stone-900">Connectivity Check</h3>
              </div>
              <button
                type="button"
                onClick={runDiagnostics}
                disabled={testStatus === 'testing'}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                <span>{testStatus === 'testing' ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {testMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                  testStatus === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : testStatus === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                {testStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{testMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <p className="text-[11px] text-stone-500">
            Current Host: <span className="font-mono text-stone-700 font-semibold">{currentHostname}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
