import React, { useState } from 'react';
import { User, UserRole, AuditAction } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { dbRepository } from '../db/in-memory-db';
import { AuditService } from '../services/audit.service';
import { ROLE_METADATA, AuthService } from '../modules/auth';
import {
  UserCheck,
  Plus,
  ShieldCheck,
  Check,
  X,
  Lock,
  Phone,
  User as UserIcon,
  ToggleLeft,
  ToggleRight,
  KeyRound,
  AlertCircle,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => dbRepository.getUsers());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add User Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STAFF);
  const [pin, setPin] = useState('1234');
  const [formError, setFormError] = useState<string | null>(null);

  const refreshUsers = () => {
    setUsers(dbRepository.getUsers());
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

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanName = name.trim();
    const cleanPin = pin.trim().replace(/\D/g, '');

    if (!cleanName) {
      setFormError('Please enter user full name');
      return;
    }

    if (cleanPhone.length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (cleanPin.length < 4) {
      setFormError('Please assign a 4-digit numeric security PIN');
      return;
    }

    // Check if phone already registered
    const existing = dbRepository.getUserByPhone(cleanPhone);
    if (existing) {
      setFormError(`A user with phone +91 ${cleanPhone} already exists (${existing.name})`);
      return;
    }

    const newUser = dbRepository.addUser({
      name: cleanName,
      phone: cleanPhone,
      role,
      pin: cleanPin,
      isActive: true,
    });

    AuditService.log({
      action: AuditAction.CREATE,
      entityType: 'USER',
      entityId: newUser.id,
      performedById: AuthService.getCurrentUser()?.id || 'system',
      performedByName: AuthService.getCurrentUser()?.name || 'Shop Owner',
      reason: `Created new ${role} user: ${cleanName}`,
    });

    // Reset & Close
    setName('');
    setPhone('');
    setPin('1234');
    setRole(UserRole.STAFF);
    setIsAddModalOpen(false);
    refreshUsers();
  };

  const permissionsMatrix = [
    {
      category: 'Counter & Mill Operations',
      items: [
        { label: 'Customer Wheat Deposit & Weighing', owner: true, staff: true, acct: false },
        { label: 'Record Atta Delivery & Exchange Fee', owner: true, staff: true, acct: false },
        { label: 'Record Ration Rice Buying from Farmer', owner: true, staff: true, acct: false },
        { label: 'Collect Cash & UPI Payments', owner: true, staff: true, acct: false },
        { label: 'Register New Farmers / Customers', owner: true, staff: true, acct: true },
        { label: 'View Customer Ledger (Khata)', owner: true, staff: true, acct: true },
      ],
    },
    {
      category: 'Trading & Inventory Control',
      items: [
        { label: 'View Grain Silos & Stock Balances', owner: true, staff: true, acct: true },
        { label: 'View Wholesaler Profiles', owner: true, staff: false, acct: true },
        { label: 'Create Wholesale Rice Dispatch / Sale', owner: true, staff: false, acct: true },
        { label: 'Manage Mandi Buyers & Contracts', owner: true, staff: false, acct: false },
      ],
    },
    {
      category: 'Financial Ledger & Cash Register',
      items: [
        { label: 'End-of-Day Physical Cash Closing', owner: true, staff: false, acct: true },
        { label: 'View Financial Summary Reports', owner: true, staff: false, acct: true },
        { label: 'View Business Analytics & Margins', owner: true, staff: false, acct: true },
        { label: 'Record Chakki Operating Expenses', owner: true, staff: false, acct: true },
      ],
    },
    {
      category: 'System Governance & Configuration',
      items: [
        { label: 'Configure Atta & Rice Rates (₹/kg)', owner: true, staff: false, acct: false },
        { label: 'Manage Staff Accounts & Security PINs', owner: true, staff: false, acct: false },
        { label: 'Access Immutable Audit Trail Logs', owner: true, staff: false, acct: true },
        { label: 'Export Database Backups (JSON/CSV)', owner: true, staff: false, acct: false },
      ],
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Users & Role-Based Access Control (RBAC)"
        description="Manage shop operators, staff members, and back-office accountant accounts"
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

      {/* Active Users Table Card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Authorized Personnel Directory</h3>
            <p className="text-xs text-stone-500">
              Users registered to access the Chakki Ledger counter and back-office
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
                <th className="p-3 font-mono">Mobile Number</th>
                <th className="p-3">Security PIN</th>
                <th className="p-3">Last Active</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => {
                const meta = ROLE_METADATA[u.role];
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
                    <td className="p-3 font-mono text-stone-700 font-medium">
                      +91 {u.phone}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                        {u.pin ? `PIN: ${u.pin}` : 'Default PIN'}
                      </span>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permission Matrix Card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-stone-900">Role Capabilities & Permission Matrix</h3>
              <p className="text-xs text-stone-500">
                Detailed enforcement rules across counter operations, accounting, and configuration
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
                      <th className="py-1.5 w-1/2">Capability</th>
                      <th className="py-1.5 text-center w-1/6 text-emerald-800 font-bold">OWNER</th>
                      <th className="py-1.5 text-center w-1/6 text-amber-800 font-bold">STAFF</th>
                      <th className="py-1.5 text-center w-1/6 text-sky-800 font-bold">ACCOUNTANT</th>
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
                          {item.staff ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-400">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {item.acct ? (
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
        subtitle="Add a new operator, staff member, or back-office accountant"
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
              10-Digit Mobile Number
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
                placeholder="9876543210"
                className="w-full pl-11 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Used for mobile PIN sign-in</p>
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
              <option value={UserRole.STAFF}>STAFF (Shop Counter Operator - Weighing & Milling)</option>
              <option value={UserRole.ACCOUNTANT}>ACCOUNTANT (Finance, Ledger, Audit, Reports)</option>
              <option value={UserRole.OWNER}>OWNER (Full Administrative & Configuration Access)</option>
            </select>
            <p className="text-[11px] text-stone-500 mt-1">
              {ROLE_METADATA[role]?.description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Security PIN (4 Digits)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
            <p className="text-[11px] text-stone-500 mt-1">Simple numeric PIN for rapid mobile entry</p>
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
