import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { UserRole } from '../../types';
import { ROLE_METADATA } from '../../modules/auth';

export interface AccessDeniedProps {
  requiredPermission?: string;
  activeRole: UserRole;
  onNavigate: (path: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredPermission,
  activeRole,
  onNavigate,
}) => {
  const roleMeta = ROLE_METADATA[activeRole];
  const fallbackPath = roleMeta?.defaultPath || '/app/home';

  return (
    <div className="p-8 max-w-lg mx-auto my-8 bg-white border border-stone-200 rounded-2xl shadow-xs text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-stone-900">Access Restricted</h3>
        <p className="text-sm text-stone-600">
          Your current account role (<span className="font-semibold text-stone-900">{roleMeta?.title || activeRole}</span>) does not have sufficient permissions to view or modify this resource.
        </p>
        {requiredPermission && (
          <p className="text-xs font-mono text-stone-500 bg-stone-100 px-2.5 py-1 rounded inline-block mt-2">
            Required: {requiredPermission}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-center gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => onNavigate(fallbackPath)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Return to {activeRole === UserRole.ACCOUNTANT ? 'Admin Dashboard' : 'Shop Counter'}
        </Button>
      </div>
    </div>
  );
};
