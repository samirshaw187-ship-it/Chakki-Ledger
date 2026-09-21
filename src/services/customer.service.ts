/**
 * Chakki Ledger - Customer Domain Service
 *
 * Enforces business rules:
 * - Server-side validation
 * - Sequential readable unique Customer Code (e.g. CUST-00001)
 * - Role-Based Access Control (RBAC)
 * - Duplicate phone detection & warning
 * - Full audit trail integration
 * - Soft deactivation (no permanent hard deletion in normal flow)
 */

import { Customer, CustomerStatus, UserRole, AuditAction } from '../types';
import { dbRepository } from '../db/in-memory-db';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';

export interface CreateCustomerDTO {
  name: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  notes?: string;
}

export interface CustomerQueryOptions {
  search?: string;
  status?: CustomerStatus | 'ALL';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'customerCode';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedCustomersResult {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface DuplicatePhoneCheckResult {
  hasDuplicate: boolean;
  existingCustomer?: Customer;
}

export interface ActorInfo {
  id: string;
  name: string;
  role: UserRole;
}

export class CustomerService {
  /**
   * Search, filter, and paginate customers
   */
  public static getCustomers(options: CustomerQueryOptions = {}): PaginatedCustomersResult {
    const {
      search = '',
      status = 'ALL',
      page = 1,
      limit = 15,
      sortBy = 'customerCode',
      sortOrder = 'asc',
    } = options;

    let all = dbRepository.getCustomers();

    // 1. Status Filter
    if (status && status !== 'ALL') {
      all = all.filter((c) => c.status === status);
    }

    // 2. Real Search (Case-insensitive across Name, Phone, and Customer Code / ID)
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      const cleanNumericQuery = q.replace(/[\s\-+]/g, '');

      all = all.filter((c) => {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesCode =
          (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
          (c.id && c.id.toLowerCase().includes(q));
        const matchesPhone =
          c.phone && (c.phone.includes(q) || (cleanNumericQuery && c.phone.includes(cleanNumericQuery)));
        const matchesAltPhone =
          c.alternatePhone &&
          (c.alternatePhone.includes(q) || (cleanNumericQuery && c.alternatePhone.includes(cleanNumericQuery)));
        const matchesAddress =
          (c.address && c.address.toLowerCase().includes(q)) ||
          (c.villageOrArea && c.villageOrArea.toLowerCase().includes(q));

        return matchesName || matchesCode || matchesPhone || matchesAltPhone || matchesAddress;
      });
    }

    // 3. Sorting
    all.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        // customerCode or default
        const codeA = a.customerCode || a.id;
        const codeB = b.customerCode || b.id;
        comparison = codeA.localeCompare(codeB);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * limit;
    const paginated = all.slice(startIndex, startIndex + limit);

    return {
      customers: paginated,
      total,
      page: safePage,
      totalPages,
      limit,
    };
  }

  /**
   * Get single customer by ID or Customer Code
   */
  public static getCustomerById(idOrCode: string): Customer | undefined {
    if (!idOrCode) return undefined;
    const all = dbRepository.getCustomers();
    return all.find(
      (c) =>
        c.id === idOrCode ||
        (c.customerCode && c.customerCode.toLowerCase() === idOrCode.toLowerCase())
    );
  }

  /**
   * Check if a phone number is already registered to an active customer
   */
  public static checkDuplicatePhone(
    phone: string | undefined,
    excludeCustomerId?: string
  ): DuplicatePhoneCheckResult {
    if (!phone || phone.trim().length === 0) {
      return { hasDuplicate: false };
    }

    const cleanInput = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    if (!cleanInput) {
      return { hasDuplicate: false };
    }

    const existing = dbRepository.getCustomers().find((c) => {
      if (excludeCustomerId && c.id === excludeCustomerId) return false;
      if (c.status !== CustomerStatus.ACTIVE) return false;

      const cleanPhone = c.phone ? c.phone.replace(/[\s\-+]/g, '').replace(/^91/, '') : '';
      const cleanAlt = c.alternatePhone ? c.alternatePhone.replace(/[\s\-+]/g, '').replace(/^91/, '') : '';

      return cleanPhone === cleanInput || cleanAlt === cleanInput;
    });

    if (existing) {
      return {
        hasDuplicate: true,
        existingCustomer: existing,
      };
    }

    return { hasDuplicate: false };
  }

  /**
   * Create a new customer with auto-generated code and server validation
   */
  public static createCustomer(data: CreateCustomerDTO, actor: ActorInfo): Customer {
    // 1. Server-side Validation
    const validation = ValidationService.validateCustomerInput(data);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError || 'Invalid customer input data.');
    }

    // 3. Auto-generate sequential unique Customer Code (e.g. CUST-00006)
    const customerCode = dbRepository.generateNextCustomerCode();

    // 4. Persistence
    const cleanPhone = data.phone?.trim() || undefined;
    const cleanAltPhone = data.alternatePhone?.trim() || undefined;
    const cleanAddress = data.address?.trim() || undefined;
    const cleanNotes = data.notes?.trim() || undefined;

    const newCustomer = dbRepository.addCustomer({
      customerCode,
      name: data.name.trim(),
      phone: cleanPhone,
      alternatePhone: cleanAltPhone,
      address: cleanAddress,
      villageOrArea: cleanAddress, // Sync for backwards compatibility
      notes: cleanNotes,
      status: CustomerStatus.ACTIVE,
      isActive: true,
      currentDueAmount: 0,
      wheatBalanceKg: 0,
      riceCreditAmount: 0,
      updatedAt: new Date().toISOString(),
    });

    // 5. Audit Trail Integration
    AuditService.log({
      action: AuditAction.CREATE,
      entityType: 'CUSTOMER',
      entityId: newCustomer.id,
      performedById: actor.id,
      performedByName: `${actor.name} (${actor.role})`,
      reason: `New customer registered: ${newCustomer.name} (${newCustomer.customerCode})`,
      newState: newCustomer as unknown as Record<string, unknown>,
    });

    return newCustomer;
  }

  /**
   * Update existing customer details (ID and Customer Code are permanent and immutable)
   */
  public static updateCustomer(id: string, data: UpdateCustomerDTO, actor: ActorInfo): Customer {
    // 1. Customer existence check
    const existing = dbRepository.getCustomerById(id);
    if (!existing) {
      throw new Error('Customer not found.');
    }

    // 3. Server-side validation
    const validation = ValidationService.validateCustomerInput(data);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError || 'Invalid customer input data.');
    }

    // 4. Apply sanitized updates (NEVER allow changing id, customerCode, createdAt)
    const updates: Partial<Customer> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.phone !== undefined) updates.phone = data.phone.trim() || undefined;
    if (data.alternatePhone !== undefined) updates.alternatePhone = data.alternatePhone.trim() || undefined;
    if (data.address !== undefined) {
      updates.address = data.address.trim() || undefined;
      updates.villageOrArea = data.address.trim() || undefined;
    }
    if (data.notes !== undefined) updates.notes = data.notes.trim() || undefined;

    const previousState = { ...existing };
    const updated = dbRepository.updateCustomer(id, updates);

    if (!updated) {
      throw new Error('Failed to update customer record.');
    }

    // 5. Audit Log
    AuditService.log({
      action: AuditAction.UPDATE,
      entityType: 'CUSTOMER',
      entityId: updated.id,
      performedById: actor.id,
      performedByName: `${actor.name} (${actor.role})`,
      reason: `Customer profile updated for ${updated.name} (${updated.customerCode})`,
      previousState: previousState as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Activate or Deactivate Customer (Soft status change with preservation of historical records)
   */
  public static setCustomerStatus(
    id: string,
    status: CustomerStatus,
    actor: ActorInfo,
    reason?: string
  ): Customer {
    // 1. Role Permission Guard: ONLY OWNER can activate or deactivate accounts
    if (actor.role !== UserRole.OWNER) {
      throw new Error('Only the Shop Owner has permission to activate or deactivate customer accounts.');
    }

    const existing = dbRepository.getCustomerById(id);
    if (!existing) {
      throw new Error('Customer not found.');
    }

    if (existing.status === status) {
      return existing;
    }

    const previousState = { ...existing };
    const isActive = status === CustomerStatus.ACTIVE;

    const updated = dbRepository.updateCustomer(id, {
      status,
      isActive,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to update customer status.');
    }

    // Audit Log
    AuditService.log({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'CUSTOMER',
      entityId: updated.id,
      performedById: actor.id,
      performedByName: `${actor.name} (${actor.role})`,
      reason:
        reason ||
        `Customer ${updated.name} (${updated.customerCode}) status changed to ${status}. Historical records preserved.`,
      previousState: previousState as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }
}
