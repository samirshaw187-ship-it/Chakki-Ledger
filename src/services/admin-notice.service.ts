/**
 * Chakki Ledger - Admin Suspicious & Abnormal Activity Notice Service
 * Enables Administrators to monitor purchases/sales and issue formal inquiries/notices
 * to Shop Owners when abnormal or suspicious activities are detected.
 */

import { SuspiciousNotice, SuspiciousNoticeStatus } from '../types';
import { AuditService } from './audit.service';
import { AuditAction } from '../types';

const STORAGE_KEY = 'chakki_suspicious_notices_v1';

class AdminNoticeService {
  private notices: SuspiciousNotice[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem(STORAGE_KEY);
        if (data) {
          this.notices = JSON.parse(data);
          return;
        }
      }
      this.notices = [];
    } catch (e) {
      console.warn('Failed to load notices from storage', e);
      this.notices = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notices));
      }
    } catch (e) {
      console.warn('Failed to save notices to storage', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Notice listener error', err);
      }
    });
  }

  public getNotices(): SuspiciousNotice[] {
    return [...this.notices].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getPendingNoticesCount(): number {
    return this.notices.filter((n) => n.status === 'PENDING_REVIEW').length;
  }

  public getNoticeById(id: string): SuspiciousNotice | undefined {
    return this.notices.find((n) => n.id === id);
  }

  public getNoticeByTransactionId(transactionId: string): SuspiciousNotice | undefined {
    return this.notices.find(
      (n) => n.transactionId === transactionId || n.transactionNumber === transactionId
    );
  }

  public createNotice(
    data: Omit<SuspiciousNotice, 'id' | 'createdAt' | 'status'>
  ): SuspiciousNotice {
    const notice: SuspiciousNotice = {
      ...data,
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'PENDING_REVIEW',
    };

    this.notices.unshift(notice);
    this.saveToStorage();

    AuditService.log({
      action: AuditAction.SUSPICIOUS_NOTICE_CREATED,
      entityType: 'TRANSACTION_AUDIT',
      entityId: notice.transactionId || notice.id,
      performedById: data.adminId,
      performedByName: data.adminName,
      reason: `Admin ${data.adminName} flagged item as ${data.category} (${data.severity}): "${data.title}"`,
    });

    return notice;
  }

  public respondToNotice(
    noticeId: string,
    shopOwnerResponse: string,
    shopOwnerName: string,
    shopOwnerId: string
  ): SuspiciousNotice | null {
    const index = this.notices.findIndex((n) => n.id === noticeId);
    if (index === -1) return null;

    const updated: SuspiciousNotice = {
      ...this.notices[index],
      shopOwnerResponse: shopOwnerResponse.trim(),
      respondedAt: new Date().toISOString(),
      status: 'EXPLAINED',
    };

    this.notices[index] = updated;
    this.saveToStorage();

    AuditService.log({
      action: AuditAction.SUSPICIOUS_NOTICE_RESPONDED,
      entityType: 'TRANSACTION_AUDIT',
      entityId: updated.transactionId || updated.id,
      performedById: shopOwnerId,
      performedByName: shopOwnerName,
      reason: `Shop Owner ${shopOwnerName} submitted explanation for notice "${updated.title}"`,
    });

    return updated;
  }

  public resolveNotice(
    noticeId: string,
    adminId: string,
    adminName: string,
    resolutionNotes?: string
  ): SuspiciousNotice | null {
    const index = this.notices.findIndex((n) => n.id === noticeId);
    if (index === -1) return null;

    const updated: SuspiciousNotice = {
      ...this.notices[index],
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      resolutionNotes: resolutionNotes?.trim(),
    };

    this.notices[index] = updated;
    this.saveToStorage();

    AuditService.log({
      action: AuditAction.SUSPICIOUS_NOTICE_RESOLVED,
      entityType: 'TRANSACTION_AUDIT',
      entityId: updated.transactionId || updated.id,
      performedById: adminId,
      performedByName: adminName,
      reason: `Admin ${adminName} resolved notice "${updated.title}"`,
    });

    return updated;
  }
}

export const adminNoticeService = new AdminNoticeService();
