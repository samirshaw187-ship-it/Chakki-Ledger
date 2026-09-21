import React, { useState, useEffect } from 'react';
import { User, UserRole, UserApprovalStatus, AuditAction } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { dbRepository } from '../db/in-memory-db';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../modules/auth';
import {
  ShieldCheck,
  Check,
  X,
  Phone,
  Store,
  Clock,
  Ban,
  PauseCircle,
  CheckCircle2,
  Search,
  Mail,
  MapPin,
  AlertTriangle,
  Shield,
  Eye,
  Trash2,
  KeyRound,
} from 'lucide-react';
import { FirebaseAuthService } from '../services/firebase-auth.service';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => dbRepository.getUsers());

  useEffect(() => {
    const unsub = dbRepository.subscribe(() => {
      setUsers(dbRepository.getUsers());
    });
    return unsub;
  }, []);

  // Active View Tab: 'SHOP_OWNERS' | 'MATRIX'
  const [activeSection, setActiveSection] = useState<'SHOP_OWNERS' | 'MATRIX'>('SHOP_OWNERS');

  // Shop Owner Filter & Search
  const [ownerStatusFilter, setOwnerStatusFilter] = useState<
    'ALL' | 'PENDING' | 'APPROVED' | 'BLOCKED' | 'DEACTIVATED'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Shop Owner Actions
  const [selectedOwner, setSelectedOwner] = useState<User | null>(null);
  const [actionType, setActionType] = useState<
    'APPROVE' | 'BLOCK' | 'DELETE' | 'VIEW_DETAILS' | 'RESET_PASSWORD' | null
  >(null);
  const [actionReason, setActionReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshUsers = () => {
    setUsers(dbRepository.getUsers());
  };

  // Filter Shop Owners
  const shopOwners = users.filter((u) => u.role === UserRole.OWNER);
  const pendingCount = shopOwners.filter(
    (u) => u.approvalStatus === 'PENDING_APPROVAL' || (!u.approvalStatus && !u.isActive)
  ).length;
  const approvedCount = shopOwners.filter(
    (u) => u.approvalStatus === 'APPROVED' || (!u.approvalStatus && u.isActive)
  ).length;
  const blockedCount = shopOwners.filter(
    (u) => u.approvalStatus === 'BLOCKED' || u.approvalStatus === 'SUSPENDED'
  ).length;

  const filteredOwners = shopOwners.filter((u) => {
    const status = u.approvalStatus || (u.isActive ? 'APPROVED' : 'DEACTIVATED');
    if (ownerStatusFilter === 'PENDING' && status !== 'PENDING_APPROVAL') return false;
    if (ownerStatusFilter === 'APPROVED' && status !== 'APPROVED') return false;
    if (
      ownerStatusFilter === 'BLOCKED' &&
      status !== 'BLOCKED' &&
      status !== 'SUSPENDED'
    )
      return false;
    if (ownerStatusFilter === 'DEACTIVATED' && status !== 'DEACTIVATED') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchPhone = u.phone.includes(q);
      const matchAddress = (u.address || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchAddress;
    }

    return true;
  });

  // Admin Actions on Shop Owner
  const handleApproveOwner = (user: User) => {
    dbRepository.updateUserApprovalStatus(user.id, 'APPROVED', actionReason || 'Approved by Admin');
    AuditService.log({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'SHOP_OWNER_APPROVAL',
      entityId: user.id,
      performedById: AuthService.getCurrentUser()?.id || 'admin',
      performedByName: AuthService.getCurrentUser()?.name || 'Administrator',
      reason: `Shop Owner ${user.name} approved for mobile app access. Note: ${actionReason || 'None'}`,
    });
    setActionMessage(`Shop Owner "${user.name}" has been approved for mobile app access.`);
    setActionType(null);
    setActionReason('');
    refreshUsers();
  };

  const handleBlockOwner = (user: User) => {
    dbRepository.updateUserApprovalStatus(
      user.id,
      'BLOCKED',
      actionReason || 'Blocked by Admin'
    );
    AuditService.log({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'SHOP_OWNER_BLOCK',
      entityId: user.id,
      performedById: AuthService.getCurrentUser()?.id || 'admin',
      performedByName: AuthService.getCurrentUser()?.name || 'Administrator',
      reason: `Shop Owner ${user.name} account blocked. Reason: ${actionReason || 'Account blocked by Administrator'}`,
    });
    setActionMessage(`Shop Owner "${user.name}" has been blocked from accessing the system.`);
    setActionType(null);
    setActionReason('');
    refreshUsers();
  };

  const handleDeleteOwner = (user: User) => {
    dbRepository.deleteUser(user.id);
    AuditService.log({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'SHOP_OWNER',
      entityId: user.id,
      performedById: AuthService.getCurrentUser()?.id || 'admin',
      performedByName: AuthService.getCurrentUser()?.name || 'Administrator',
      reason: `Shop Owner ${user.name} permanently deleted. Reason: ${actionReason || 'Deleted by Administrator'}`,
    });
    setActionMessage(`Shop Owner "${user.name}" has been permanently deleted.`);
    setActionType(null);
    setActionReason('');
    refreshUsers();
  };

  const handleInitiatePasswordReset = async (user: User) => {
    const adminUser = AuthService.getCurrentUser() || {
      id: 'admin_1',
      name: 'System Administrator',
      role: UserRole.ADMIN,
      phone: '9876543210',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    if (!user.email) {
      setActionMessage(`Cannot reset password: Shop Owner "${user.name}" does not have an email registered.`);
      setActionType(null);
      return;
    }

    try {
      const result = await FirebaseAuthService.adminInitiatePasswordReset(user.email, adminUser);
      if (result.success) {
        setActionMessage(result.message || `Password reset link dispatched to ${user.email}.`);
      } else {
        setActionMessage(`Password reset failed: ${result.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error sending reset email: ${err.message}`);
    }

    setActionType(null);
    setActionReason('');
    refreshUsers();
  };

  const permissionsMatrix = [
    {
      category: 'Mobile Application Operations (Chakki Counter)',
      items: [
        { label: 'Mobile View Application Access', owner: true, admin: false },
        { label: 'Customer Wheat Deposit & Weighing', owner: true, admin: true },
        { label: 'Record Atta Delivery & Exchange Fee', owner: true, admin: true },
        { label: 'Record Ration Rice Buying from Farmer', owner: true, admin: true },
        { label: 'Collect Cash & UPI Customer Payments', owner: true, admin: true },
        { label: 'Register New Farmers / Customers', owner: true, admin: true },
        { label: 'View Customer Ledger (Khata)', owner: true, admin: true },
      ],
    },
    {
      category: 'Inventory, Trading & Field Operations',
      items: [
        { label: 'View Grain Silos & Stock Balances', owner: true, admin: true },
        { label: 'View Wholesaler Profiles', owner: true, admin: true },
        { label: 'Create Wholesale Rice Dispatch / Sale', owner: true, admin: true },
        { label: 'Record Daily Operating Expenses', owner: true, admin: true },
      ],
    },
    {
      category: 'Admin Dashboard & Governance',
      items: [
        { label: 'Admin Dashboard Full Access', owner: false, admin: true },
        { label: 'Monitor Shop Owner Full Activity & Transactions', owner: false, admin: true },
        { label: 'Real-time Sales & Selling Monitoring', owner: false, admin: true },
        { label: 'Live Inventory & Rice Trading Activity', owner: false, admin: true },
        { label: 'Monitor Wholesaler & Grain Dealings', owner: false, admin: true },
        { label: 'Suspicious Activity & Anomaly Detection', owner: false, admin: true },
        { label: 'Block / Suspend Shop Owner Account', owner: false, admin: true },
        { label: 'Delete Shop Owner Account Permanently', owner: false, admin: true },
        { label: 'Immutable Audit Trail Logs', owner: false, admin: true },
        { label: 'System Backup & Export Data', owner: false, admin: true },
      ],
    },
  ];

  return (
    <div className="space-y-6 font-sans antialiased text-stone-900">
      <PageHeader
        title="User & Shop Owner Management"
        description="Monitor and manage Shop Owner accounts, configure approval states, and enforce strict role-based access"
        breadcrumbs={['Admin', 'User Management']}
      />

      {/* Success Notification Alert */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Section Tabs */}
      <div className="flex border-b border-stone-200 bg-white rounded-t-xl px-2 pt-2">
        <button
          type="button"
          onClick={() => setActiveSection('SHOP_OWNERS')}
          className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-all flex items-center gap-2 ${
            activeSection === 'SHOP_OWNERS'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Shop Owner Accounts</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-bold animate-pulse">
              {pendingCount} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('MATRIX')}
          className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-all flex items-center gap-2 ${
            activeSection === 'MATRIX'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Role & Permissions Matrix</span>
        </button>
      </div>

      {/* ===================== SECTION 1: SHOP OWNERS ===================== */}
      {activeSection === 'SHOP_OWNERS' && (
        <div className="space-y-4">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card className="p-3 bg-white border border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                    Total Shop Owners
                  </p>
                  <p className="text-xl font-bold text-stone-900 mt-0.5">{shopOwners.length}</p>
                </div>
                <div className="w-9 h-9 bg-stone-100 text-stone-600 rounded-xl flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-white border border-emerald-200 bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
                    Active & Approved
                  </p>
                  <p className="text-xl font-bold text-emerald-900 mt-0.5">{approvedCount}</p>
                </div>
                <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-white border border-amber-200 bg-amber-50/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
                    Pending Approval
                  </p>
                  <p className="text-xl font-bold text-amber-900 mt-0.5">{pendingCount}</p>
                </div>
                <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-white border border-red-200 bg-red-50/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-red-700 uppercase tracking-wider">
                    Blocked Accounts
                  </p>
                  <p className="text-xl font-bold text-red-900 mt-0.5">{blockedCount}</p>
                </div>
                <div className="w-9 h-9 bg-red-100 text-red-700 rounded-xl flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
              </div>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search shop owner by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-emerald-600 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(['ALL', 'PENDING', 'APPROVED', 'BLOCKED'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setOwnerStatusFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    ownerStatusFilter === filter
                      ? 'bg-stone-900 text-white font-semibold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {filter === 'ALL'
                    ? 'All'
                    : filter === 'PENDING'
                    ? 'Pending'
                    : filter === 'APPROVED'
                    ? 'Approved'
                    : 'Blocked'}
                </button>
              ))}
            </div>
          </div>

          {/* Shop Owners List Table */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Shop Owner Details</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Access</th>
                    <th className="p-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOwners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-500">
                        <p className="font-semibold">No Shop Owners Found</p>
                        <p className="text-xs text-stone-400 mt-1">
                          {searchQuery
                            ? `No results matching "${searchQuery}"`
                            : 'No accounts match the selected filter'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredOwners.map((owner) => {
                      const status =
                        owner.approvalStatus || (owner.isActive ? 'APPROVED' : 'DEACTIVATED');
                      const isBlocked = status === 'BLOCKED' || status === 'SUSPENDED';

                      return (
                        <tr
                          key={owner.id}
                          className={`hover:bg-stone-50/70 transition-colors ${
                            status === 'PENDING_APPROVAL' ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* Owner Details */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                                  status === 'APPROVED'
                                    ? 'bg-emerald-700'
                                    : status === 'PENDING_APPROVAL'
                                    ? 'bg-amber-600'
                                    : isBlocked
                                    ? 'bg-red-600'
                                    : 'bg-stone-500'
                                }`}
                              >
                                {owner.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-stone-900 flex items-center gap-1.5">
                                  {owner.name}
                                  {status === 'APPROVED' && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                  )}
                                </p>
                                <p className="text-[11px] text-stone-500">
                                  ID: <span className="font-mono">{owner.id}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Email & Phone */}
                          <td className="p-3">
                            <p className="font-mono font-medium text-stone-900 text-[11px] flex items-center gap-1">
                              <Mail className="w-3 h-3 text-stone-400" />
                              {owner.email || 'No email on file'}
                            </p>
                            <p className="font-mono text-stone-500 text-[11px] mt-0.5 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400" />
                              +91 {owner.phone}
                            </p>
                          </td>

                          {/* Address */}
                          <td className="p-3 text-stone-600 max-w-xs">
                            <p className="text-xs truncate flex items-start gap-1">
                              <MapPin className="w-3 h-3 text-stone-400 shrink-0 mt-0.5" />
                              <span className="truncate">{owner.address || 'Address not specified'}</span>
                            </p>
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              Joined: {new Date(owner.createdAt).toLocaleDateString('en-IN')}
                            </p>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {status === 'PENDING_APPROVAL' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Under Review
                              </span>
                            )}
                            {status === 'APPROVED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                Approved
                              </span>
                            )}
                            {isBlocked && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                                <Ban className="w-3 h-3 text-red-700" />
                                Blocked
                              </span>
                            )}
                            {status === 'DEACTIVATED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
                                <Ban className="w-3 h-3 text-stone-500" />
                                Deactivated
                              </span>
                            )}
                          </td>

                          {/* App Access Indicator */}
                          <td className="p-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                owner.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {owner.isActive ? 'Allowed' : 'Blocked'}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Inspect Profile */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOwner(owner);
                                  setActionType('VIEW_DETAILS');
                                }}
                                title="Inspect Details"
                                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* PENDING APPROVAL ACTIONS */}
                              {status === 'PENDING_APPROVAL' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOwner(owner);
                                    setActionType('APPROVE');
                                    setActionReason('');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </button>
                              )}

                              {/* APPROVED ACTIONS: Block & Delete */}
                              {status === 'APPROVED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOwner(owner);
                                    setActionType('BLOCK');
                                    setActionReason('');
                                  }}
                                  className="px-2 py-1 border border-orange-300 text-orange-800 hover:bg-orange-50 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Ban className="w-3 h-3" />
                                  Block
                                </button>
                              )}

                              {/* BLOCKED ACTIONS: Unblock */}
                              {isBlocked && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOwner(owner);
                                    setActionType('APPROVE');
                                    setActionReason('Account unblocked and reinstated by Administrator');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  Unblock
                                </button>
                              )}

                              {/* ADMIN PASSWORD RESET BUTTON (Admin initiates reset link) */}
                              {owner.email && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOwner(owner);
                                    setActionType('RESET_PASSWORD');
                                    setActionReason('');
                                  }}
                                  title="Admin-Initiated Password Reset (Send reset email)"
                                  className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors cursor-pointer"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* DELETE BUTTON (Admin can delete when required) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOwner(owner);
                                  setActionType('DELETE');
                                  setActionReason('');
                                }}
                                title="Delete Shop Owner Account"
                                className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SECTION 2: RBAC MATRIX ===================== */}
      {activeSection === 'MATRIX' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-sm font-bold text-stone-900">Role Capabilities & Permission Matrix</h3>
                <p className="text-xs text-stone-500">
                  Strict boundaries between Shop Owner (Mobile Application View) and Admin (Complete Admin Dashboard)
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {permissionsMatrix.map((group) => (
              <div key={group.category} className="p-4 space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-stone-500">
                  {group.category}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] font-semibold text-stone-500 border-b border-stone-100">
                        <th className="py-2 w-3/5">System Capability</th>
                        <th className="py-2 text-center w-1/5">
                          <span className="font-bold text-emerald-800">Shop Owner</span>
                          <span className="block text-[10px] font-normal text-stone-400">Mobile View Only</span>
                        </th>
                        <th className="py-2 text-center w-1/5">
                          <span className="font-bold text-purple-800">Platform Admin</span>
                          <span className="block text-[10px] font-normal text-stone-400">Admin Dashboard</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {group.items.map((item) => (
                        <tr key={item.label} className="hover:bg-stone-50/50">
                          <td className="py-2.5 text-stone-800 font-medium">{item.label}</td>
                          <td className="py-2.5 text-center">
                            {item.owner ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-stone-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            {item.admin ? (
                              <Check className="w-4 h-4 text-purple-600 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-stone-300 mx-auto" />
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
      )}

      {/* ===================== MODAL: APPROVE SHOP OWNER ===================== */}
      <Modal
        isOpen={actionType === 'APPROVE' && !!selectedOwner}
        onClose={() => setActionType(null)}
        title="Approve / Reinstate Shop Owner Account"
        subtitle={`Grant mobile application access to ${selectedOwner?.name}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => selectedOwner && handleApproveOwner(selectedOwner)}
            >
              Confirm Approval
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-stone-700">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">Mobile View Access Activation</p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Once approved, the Shop Owner can sign in via phone / OTP and manage their daily chakki transactions.
                They will have NO access to the Admin Dashboard.
              </p>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-stone-500">Shop Owner:</span>
              <span className="font-bold text-stone-900">{selectedOwner?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Contact:</span>
              <span className="font-mono text-stone-900">+91 {selectedOwner?.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Shop Address:</span>
              <span className="text-stone-900">{selectedOwner?.address || 'Not specified'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Approval Note (Optional)
            </label>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Identity and shop verified"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* ===================== MODAL: BLOCK SHOP OWNER ===================== */}
      <Modal
        isOpen={actionType === 'BLOCK' && !!selectedOwner}
        onClose={() => setActionType(null)}
        title="Block Shop Owner Account"
        subtitle={`Immediately revoke access for ${selectedOwner?.name}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => selectedOwner && handleBlockOwner(selectedOwner)}
            >
              Block Account
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-stone-700">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
            <Ban className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900">Account Block Warning</p>
              <p className="text-red-800 text-[11px] mt-0.5">
                The Shop Owner will be immediately blocked from signing in to the mobile app. All active sessions
                will be invalidated until unblocked by an Administrator.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Reason for Blocking <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Audit discrepancy, security concern, or dispute"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* ===================== MODAL: DELETE SHOP OWNER ===================== */}
      <Modal
        isOpen={actionType === 'DELETE' && !!selectedOwner}
        onClose={() => setActionType(null)}
        title="Delete Shop Owner Account"
        subtitle={`Permanently delete ${selectedOwner?.name}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => selectedOwner && handleDeleteOwner(selectedOwner)}
            >
              Permanently Delete Account
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-stone-700">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900">Irreversible Action</p>
              <p className="text-red-800 text-[11px] mt-0.5">
                This will permanently delete the Shop Owner account ({selectedOwner?.name}, phone: +91 {selectedOwner?.phone}).
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Deletion Reason / Reference
            </label>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Shop owner requested account closure or business dissolved"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* ===================== MODAL: RESET PASSWORD ===================== */}
      <Modal
        isOpen={actionType === 'RESET_PASSWORD' && !!selectedOwner}
        onClose={() => setActionType(null)}
        title="Admin-Initiated Password Reset"
        subtitle={`Dispatch reset instructions to ${selectedOwner?.name}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => selectedOwner && handleInitiatePasswordReset(selectedOwner)}
            >
              Send Password Reset Link
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-stone-700">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <KeyRound className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Admin Governance & Security Protocol</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Per security regulations, Shop Owners cannot independently change their passwords.
                Only an Administrator can trigger this reset. An official Firebase password reset email
                will be dispatched to <strong>{selectedOwner?.email}</strong>.
              </p>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-stone-500">Shop Owner:</span>
              <span className="font-bold text-stone-900">{selectedOwner?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Registered Email:</span>
              <span className="font-mono text-stone-900">{selectedOwner?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Mobile Phone:</span>
              <span className="font-mono text-stone-900">+91 {selectedOwner?.phone}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* ===================== MODAL: VIEW DETAILS ===================== */}
      <Modal
        isOpen={actionType === 'VIEW_DETAILS' && !!selectedOwner}
        onClose={() => setActionType(null)}
        title="Shop Owner Profile & Status"
        subtitle={selectedOwner?.name}
        maxWidth="md"
      >
        {selectedOwner && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-base">
                {selectedOwner.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">{selectedOwner.name}</h4>
                <p className="text-stone-500 font-mono text-xs">{selectedOwner.email || 'No email'}</p>
                <p className="text-[11px] text-emerald-800 font-medium">Role: Shop Owner (Mobile View Only)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <span className="text-[11px] text-stone-500">Contact Number:</span>
                <p className="font-mono font-bold text-stone-900">+91 {selectedOwner.phone}</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <span className="text-[11px] text-stone-500">Current Status:</span>
                <p className="font-bold text-stone-900">
                  {selectedOwner.approvalStatus || (selectedOwner.isActive ? 'APPROVED' : 'INACTIVE')}
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
              <span className="text-[11px] text-stone-500">Shop / Mill Physical Address:</span>
              <p className="text-stone-900 font-medium leading-relaxed">
                {selectedOwner.address || 'No physical address entered.'}
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
              <span className="text-[11px] text-stone-500">Application Date:</span>
              <p className="text-stone-900">
                {new Date(selectedOwner.createdAt).toLocaleString('en-IN')}
              </p>
            </div>

            {selectedOwner.rejectionReason && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <span className="text-[11px] font-bold">Latest Admin Note / Reason:</span>
                <p>{selectedOwner.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
