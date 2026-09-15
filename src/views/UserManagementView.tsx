import React, { useState, useEffect } from 'react';
import { User, UserRole, AuditAction } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { dbRepository } from '../db/in-memory-db';
import { AuditService } from '../services/audit.service';
import { ROLE_METADATA, AuthService, validateGmail, validatePassword } from '../modules/auth';
import { ChangePasswordCard } from '../components/domain/ChangePasswordCard';
import {
  Plus,
  ShieldCheck,
  Check,
  X,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  UserCheck,
  UserX,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => dbRepository.getUsers());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Add User Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Real-time validation
  const emailValidation = validateGmail(email);
  const passwordValidation = validatePassword(password);

  const refreshUsers = () => {
    setUsers(dbRepository.getUsers());
  };

  useEffect(() => {
    const unsub = dbRepository.subscribe(refreshUsers);
    return unsub;
  }, []);

  const handleApproveAccount = async (targetUser: User, approve: boolean) => {
    const adminUser = AuthService.getCurrentUser();
    if (!adminUser) {
      alert('Please sign in as Administrator to approve or reject accounts.');
      return;
    }

    try {
      const result = await AuthService.approveUser(adminUser, targetUser.id, approve);
      if (result.success) {
        setActionFeedback(
          approve
            ? `Successfully approved ${targetUser.name}'s Shop Owner account.`
            : `Registration for ${targetUser.name} was rejected.`
        );
        refreshUsers();
        setTimeout(() => setActionFeedback(null), 4000);
      } else {
        alert(result.error || 'Failed to update approval status.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred while updating account approval.');
    }
  };

  const handleToggleStatus = (user: User) => {
    // Prevent deactivating the last active owner
    if (user.role === UserRole.OWNER && user.isActive) {
      const activeOwners = users.filter((u) => u.role === UserRole.OWNER && u.isActive);
      if (activeOwners.length <= 1) {
        alert('Cannot deactivate the sole Shop Owner account. The chakki must have at least one active owner.');
        return;
      }
    }

    dbRepository.toggleUserStatus(user.id);
    AuditService.log({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'USER',
      entityId: user.id,
      performedById: AuthService.getCurrentUser()?.id || 'system',
      performedByName: AuthService.getCurrentUser()?.name || 'Shop Owner',
      reason: `User ${user.name} status changed to ${!user.isActive ? 'Active' : 'Deactivated'}`,
    });
    refreshUsers();
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setFormError('Please enter user full name');
      return;
    }

    // Strict Gmail check
    const emailResult = validateGmail(cleanEmail);
    if (!emailResult.isValid) {
      setFormError(emailResult.error || 'Email must contain @gmail.com at the end');
      return;
    }

    // Strict password check
    const passwordResult = validatePassword(password);
    if (!passwordResult.isValid) {
      setFormError(passwordResult.error || 'Password must meet all security requirements');
      return;
    }

    // Check if email already registered
    const existingEmail = dbRepository.getUserByEmail(cleanEmail);
    if (existingEmail) {
      setFormError(`A user with email ${cleanEmail} already exists (${existingEmail.name})`);
      return;
    }

    const newUser = dbRepository.addUser({
      name: cleanName,
      email: cleanEmail,
      phone: '',
      role,
      password,
      isActive: true,
    });

    AuditService.log({
      action: AuditAction.CREATE,
      entityType: 'USER',
      entityId: newUser.id,
      performedById: AuthService.getCurrentUser()?.id || 'system',
      performedByName: AuthService.getCurrentUser()?.name || 'Shop Owner',
      reason: `Created new ${role} account: ${cleanName} (${cleanEmail})`,
    });

    // Reset & Close
    setName('');
    setEmail('');
    setPassword('');
    setRole(UserRole.ADMIN);
    setIsAddModalOpen(false);
    refreshUsers();
  };

  const permissionsMatrix = [
    {
      category: 'Counter & Mill Operations',
      items: [
        { label: 'Customer Wheat Deposit & Weighing', owner: true, admin: true },
        { label: 'Record Atta Delivery & Exchange Fee', owner: true, admin: true },
        { label: 'Record Ration Rice Buying from Farmer', owner: true, admin: true },
        { label: 'Collect Cash & UPI Payments', owner: true, admin: true },
        { label: 'Register New Farmers / Customers', owner: true, admin: true },
        { label: 'View Customer Ledger (Khata)', owner: true, admin: true },
      ],
    },
    {
      category: 'Trading & Inventory Control',
      items: [
        { label: 'View Grain Silos & Stock Balances', owner: true, admin: true },
        { label: 'View Wholesaler Profiles', owner: true, admin: true },
        { label: 'Create Wholesale Rice Dispatch / Sale', owner: true, admin: true },
        { label: 'Manage Mandi Buyers & Contracts', owner: true, admin: true },
      ],
    },
    {
      category: 'Financial Ledger & Cash Register',
      items: [
        { label: 'End-of-Day Physical Cash Closing', owner: true, admin: true },
        { label: 'View Financial Summary Reports', owner: true, admin: true },
        { label: 'View Business Analytics & Margins', owner: true, admin: true },
        { label: 'Record Chakki Operating Expenses', owner: true, admin: true },
      ],
    },
    {
      category: 'System Governance & Configuration',
      items: [
        { label: 'Configure Atta & Rice Rates (₹/kg)', owner: true, admin: true },
        { label: 'Manage Owner & Admin Accounts & Passwords', owner: true, admin: true },
        { label: 'Access Immutable Audit Trail Logs', owner: true, admin: true },
        { label: 'Export Database Backups (JSON/CSV)', owner: true, admin: true },
      ],
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Users & Role-Based Access Control (RBAC)"
        description="Manage Shop Owner and Administrator accounts, credentials, and access rights"
        breadcrumbs={['Admin', 'Users']}
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add New User
          </Button>
        }
      />

      {/* Feedback notification */}
      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Pending Shop Owner Approvals Section */}
      {(() => {
        const pendingUsers = users.filter((u) => u.role === UserRole.OWNER && (!u.isApproved || u.approvalStatus === 'PENDING'));
        if (pendingUsers.length === 0) return null;

        return (
          <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-700" />
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Mandatory Approvals: {pendingUsers.length} Pending Shop Owner Account{pendingUsers.length > 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-amber-800">
                    Newly registered Shop Owners cannot log in until you (Samir - Administrator) approve them.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {pendingUsers.map((pending) => (
                <div key={pending.id} className="bg-white border border-amber-200 rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-stone-900 text-sm">{pending.name}</p>
                      <p className="text-xs text-stone-600 font-mono">{pending.email}</p>
                      {pending.phone && (
                        <p className="text-[11px] text-stone-500">Phone: +91 {pending.phone}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      Pending Approval
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => handleApproveAccount(pending, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      <UserCheck className="w-4 h-4" /> Approve Account
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveAccount(pending, false)}
                      className="flex items-center justify-center gap-1 py-1.5 px-3 bg-white border border-stone-300 hover:bg-red-50 hover:text-red-700 text-stone-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      <UserX className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Active Users Table Card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Authorized Personnel Directory</h3>
            <p className="text-xs text-stone-500">
              Users authorized to access Chakki Ledger portal (Owner and Admin only)
            </p>
          </div>
          <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
            {users.length} Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
              <tr>
                <th className="p-3">User Details</th>
                <th className="p-3">Role & Scope</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Approval</th>
                <th className="p-3">Last Active</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => {
                const meta = ROLE_METADATA[u.role];
                const isPending = u.role === UserRole.OWNER && (!u.isApproved || u.approvalStatus === 'PENDING');
                const isRejected = u.approvalStatus === 'REJECTED';

                return (
                  <tr key={u.id} className={`hover:bg-stone-50/70 transition-colors ${!u.isActive ? 'opacity-60 bg-stone-50/40' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{u.name}</p>
                          <p className="text-[11px] text-stone-500">{u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`font-bold px-2 py-0.5 rounded border inline-block text-[11px] ${meta?.badgeClass || 'bg-stone-100 text-stone-700'}`}>
                        {u.role}
                      </span>
                      <p className="text-[10px] text-stone-500 mt-0.5">{meta?.title}</p>
                    </td>
                    <td className="p-3 font-medium text-stone-800">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        <span>{u.email || `${u.phone || 'user'}@gmail.com`}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" /> Pending Admin
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                          <X className="w-3 h-3 text-red-600" /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" /> Approved
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-stone-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : 'Not logged in yet'}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleApproveAccount(u, true)}
                            className="px-2 py-1 rounded text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer shadow-2xs"
                            title="Approve Shop Owner Account"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                            u.isActive
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Password Management for Current User */}
      <div className="max-w-2xl">
        <ChangePasswordCard onSuccess={refreshUsers} />
      </div>

      {/* Role Permission Matrix Card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-stone-900">Role Capabilities & Permission Matrix</h3>
              <p className="text-xs text-stone-500">
                Authorized roles for Chakki Ledger: Shop Owner & Administrator
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-stone-100 text-xs">
          {permissionsMatrix.map((group) => (
            <div key={group.category} className="p-4 space-y-2">
              <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] text-stone-500">
                {group.category}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold text-stone-500 border-b border-stone-100">
                      <th className="py-1.5 w-2/3">Capability</th>
                      <th className="py-1.5 text-center w-1/6 text-emerald-800 font-bold">OWNER</th>
                      <th className="py-1.5 text-center w-1/6 text-sky-800 font-bold">ADMIN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {group.items.map((item) => (
                      <tr key={item.label} className="hover:bg-stone-50/50">
                        <td className="py-2 text-stone-800 font-medium">{item.label}</td>
                        <td className="py-2 text-center">
                          {item.owner ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-400">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {item.admin ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 text-sky-800">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-400">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Personnel"
        subtitle="Add a new Shop Owner or Administrator account"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Chandra"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@gmail.com"
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>Must contain <strong>@gmail.com</strong> at the end</span>
              {email && (
                emailValidation.isValid ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-0.5 text-[10px]">
                    <Check className="w-3 h-3" /> Valid Gmail
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium text-[10px]">
                    Requires @gmail.com
                  </span>
                )
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Assigned Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              <option value={UserRole.ADMIN}>ADMIN (Administrator - Operations, Ledger & Audit)</option>
              <option value={UserRole.OWNER}>OWNER (Shop Owner - Full Authority & Configuration)</option>
            </select>
            <p className="text-[11px] text-stone-500 mt-1">
              {ROLE_METADATA[role]?.description}
            </p>
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
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            {/* Password Real-Time Checklist */}
            <div className="mt-2 p-2 bg-stone-50 rounded-lg border border-stone-200 space-y-1 text-[11px]">
              <div className="font-semibold text-stone-700 text-[10px] uppercase tracking-wider">
                Password Requirements:
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <span className={`flex items-center gap-1 ${passwordValidation.rules.minLength ? 'text-emerald-700 font-medium' : 'text-stone-500'}`}>
                  {passwordValidation.rules.minLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2.5 h-2.5 rounded-full border border-stone-300 inline-block" />}
                  8+ characters
                </span>
                <span className={`flex items-center gap-1 ${passwordValidation.rules.hasUpper ? 'text-emerald-700 font-medium' : 'text-stone-500'}`}>
                  {passwordValidation.rules.hasUpper ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2.5 h-2.5 rounded-full border border-stone-300 inline-block" />}
                  1+ uppercase (A-Z)
                </span>
                <span className={`flex items-center gap-1 ${passwordValidation.rules.hasLower ? 'text-emerald-700 font-medium' : 'text-stone-500'}`}>
                  {passwordValidation.rules.hasLower ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2.5 h-2.5 rounded-full border border-stone-300 inline-block" />}
                  1+ lowercase (a-z)
                </span>
                <span className={`flex items-center gap-1 ${passwordValidation.rules.hasNumber ? 'text-emerald-700 font-medium' : 'text-stone-500'}`}>
                  {passwordValidation.rules.hasNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2.5 h-2.5 rounded-full border border-stone-300 inline-block" />}
                  1+ number (0-9)
                </span>
                <span className={`flex items-center gap-1 col-span-2 ${passwordValidation.rules.hasSpecial ? 'text-emerald-700 font-medium' : 'text-stone-500'}`}>
                  {passwordValidation.rules.hasSpecial ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-2.5 h-2.5 rounded-full border border-stone-300 inline-block" />}
                  1+ special character (!@#$%^&*)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save & Activate User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
