import React, { useState } from 'react';
import { useAuth } from '../modules/auth';
import { CustomerService } from '../services/customer.service';
import { Customer, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import {
  ArrowLeft,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plus,
  Phone,
  User,
  MapPin,
  FileText,
} from 'lucide-react';

export interface MobileAddCustomerViewProps {
  onNavigate: (path: string) => void;
}

export const MobileAddCustomerView: React.FC<MobileAddCustomerViewProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // UI States
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<Customer | null>(null);
  const [bypassDuplicateWarning, setBypassDuplicateWarning] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);

  // Phone input handler with duplicate detection
  const handlePhoneChange = (val: string) => {
    // Only allow digits, spaces, hyphens
    const cleaned = val.replace(/[^\d\s-]/g, '');
    setPhone(cleaned);
    setBypassDuplicateWarning(false);

    // Duplicate check if at least 10 digits
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      const check = CustomerService.checkDuplicatePhone(digitsOnly);
      if (check.hasDuplicate && check.existingCustomer) {
        setDuplicateMatch(check.existingCustomer);
      } else {
        setDuplicateMatch(null);
      }
    } else {
      setDuplicateMatch(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic client check
    if (!name.trim()) {
      setFormError('Please enter the customer\'s full name.');
      return;
    }

    // If duplicate phone detected and user hasn't explicitly clicked "Continue Anyway"
    if (duplicateMatch && !bypassDuplicateWarning) {
      setFormError('Duplicate phone number detected. Please review the notice below.');
      return;
    }

    if (!user) {
      setFormError('Active user session is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const actor = {
        id: user.id,
        name: user.name,
        role: role || UserRole.STAFF,
      };

      const newCust = CustomerService.createCustomer(
        {
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        actor
      );

      setCreatedCustomer(newCust);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while registering the customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setFormError(null);
    setDuplicateMatch(null);
    setBypassDuplicateWarning(false);
    setCreatedCustomer(null);
  };

  // SUCCESS CONFIRMATION SCREEN
  if (createdCustomer) {
    const displayCode = createdCustomer.customerCode || createdCustomer.id;
    return (
      <div className="space-y-4 font-sans max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 sm:p-6 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-stone-900">
              Customer Added Successfully!
            </h2>
            <p className="text-xs text-stone-600">
              New customer ledger record has been generated.
            </p>
          </div>

          {/* Generated Customer Details Box */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-left space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500 font-medium">Customer Name</span>
              <span className="text-sm font-bold text-stone-900">{createdCustomer.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500 font-medium">Customer ID (Unique)</span>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {displayCode}
              </span>
            </div>
            {createdCustomer.phone && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 font-medium">Phone Number</span>
                <span className="text-xs font-mono text-stone-800">+91 {createdCustomer.phone}</span>
              </div>
            )}
            {createdCustomer.address && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 font-medium">Address / Village</span>
                <span className="text-xs text-stone-800 truncate max-w-[200px]">{createdCustomer.address}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Account Status</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleResetForm}
              className="w-full"
            >
              Add Another
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<UserCheck className="w-4 h-4" />}
              onClick={() => onNavigate(`/app/customers/${createdCustomer.id}`)}
              className="w-full"
            >
              View Customer
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/app/customers')}
          className="text-xs font-semibold text-stone-600 flex items-center justify-center gap-1.5 hover:text-stone-900 transition-colors w-full py-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers List</span>
        </button>
      </div>
    );
  }

  // ADD CUSTOMER FORM SCREEN
  return (
    <div className="space-y-4 font-sans max-w-lg mx-auto">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => onNavigate('/app/customers')}
        className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Customers</span>
      </button>

      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 leading-tight">
            Add New Customer
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Customer ID will be automatically generated. No manual code needed.
          </p>
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name (Required) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800">
              Full Name <span className="text-red-600 font-bold">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Ghosh"
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs min-h-[44px]"
              />
            </div>
          </div>

          {/* Mobile Number (Optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800 flex items-center justify-between">
              <span>Mobile Number</span>
              <span className="text-[11px] text-stone-400 font-normal">Optional</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="10-digit phone number (e.g. 9830012345)"
                maxLength={12}
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs min-h-[44px]"
              />
            </div>
          </div>

          {/* DUPLICATE PHONE NUMBER WARNING BANNER */}
          {duplicateMatch && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs space-y-2.5">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs leading-tight">
                    A customer with this phone number already exists.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Existing account: <strong>{duplicateMatch.name}</strong> (ID: {duplicateMatch.customerCode || duplicateMatch.id})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  onClick={() => onNavigate(`/app/customers/${duplicateMatch.id}`)}
                  className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50"
                >
                  Open Existing Customer
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBypassDuplicateWarning(true);
                    setFormError(null);
                  }}
                  className={`text-xs ${
                    bypassDuplicateWarning
                      ? 'text-emerald-700 font-bold bg-emerald-50'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {bypassDuplicateWarning ? '✓ Proceeding with save' : 'Continue Anyway'}
                </Button>
              </div>
            </div>
          )}

          {/* Address / Village (Optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800 flex items-center justify-between">
              <span>Village / Ward / Area</span>
              <span className="text-[11px] text-stone-400 font-normal">Optional</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Rampur Village, Ward 3"
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs min-h-[44px]"
              />
            </div>
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-800 flex items-center justify-between">
              <span>Notes</span>
              <span className="text-[11px] text-stone-400 font-normal">Optional</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Regular milling customer, family account"
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
            >
              Save Customer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
