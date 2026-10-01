import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../../modules/auth';
import { UserRole } from '../../types';
import { adminNoticeService } from '../admin-notice.service';

test('Strict Role Exclusivity: Shop Owner cannot login under Admin account type', async () => {
  // Attempting to log into Admin with Shop Owner email (owner@gmail.com)
  const result = await AuthService.loginWithEmailPassword(
    'owner@gmail.com',
    'Owner@1234',
    UserRole.ADMIN
  );

  assert.equal(result.success, false);
  assert.match(
    result.error || '',
    /Access Denied: This account is registered as a Shop Owner/
  );
});

test('Strict Role Exclusivity: Admin cannot login under Shop Owner account type', async () => {
  // Attempting to log into Shop Owner with Admin email (admin@gmail.com)
  const result = await AuthService.loginWithEmailPassword(
    'admin@gmail.com',
    'Admin@1234',
    UserRole.OWNER
  );

  assert.equal(result.success, false);
  assert.match(
    result.error || '',
    /Access Denied: This account is registered as an Administrator/
  );
});

test('Authorized Logins succeed under their respective selected account types', async () => {
  // Admin logs in under Admin account type
  const adminLogin = await AuthService.loginWithEmailPassword(
    'admin@gmail.com',
    'Admin@1234',
    UserRole.ADMIN
  );
  assert.equal(adminLogin.success, true);
  assert.equal(adminLogin.session?.role, UserRole.ADMIN);

  // Shop Owner logs in under Shop Owner account type
  const ownerLogin = await AuthService.loginWithEmailPassword(
    'owner@gmail.com',
    'Owner@1234',
    UserRole.OWNER
  );
  assert.equal(ownerLogin.success, true);
  assert.equal(ownerLogin.session?.role, UserRole.OWNER);
});

test('Admin Notice & Suspicious Activity Workflow', () => {
  const notice = adminNoticeService.createNotice({
    transactionId: 'tx-test-999',
    transactionNumber: 'TXN-2026-9999',
    itemType: 'Ration Rice 400kg',
    customerName: 'Kishore Farmer',
    quantity: 400,
    rate: 22,
    totalAmount: 8800,
    transactionDate: new Date().toISOString(),
    category: 'ABNORMAL_PURCHASE_QUANTITY',
    severity: 'WARNING',
    title: 'Abnormal Purchase Quantity: TXN-2026-9999',
    message: 'Weighment slip required for 400kg ration rice intake.',
    adminId: 'admin_master_1',
    adminName: 'Platform Administrator',
  });

  assert.ok(notice.id);
  assert.equal(notice.status, 'PENDING_REVIEW');
  assert.equal(adminNoticeService.getPendingNoticesCount() >= 1, true);

  // Shop Owner responds with clarification
  const updatedNotice = adminNoticeService.respondToNotice(
    notice.id,
    'Verified with customer slip #412; farmer brought harvest surplus.',
    'Ramesh Kumar',
    'owner_1'
  );

  assert.equal(updatedNotice?.status, 'EXPLAINED');
  assert.equal(updatedNotice?.shopOwnerResponse, 'Verified with customer slip #412; farmer brought harvest surplus.');

  // Admin reviews and resolves
  const resolvedNotice = adminNoticeService.resolveNotice(
    notice.id,
    'admin_master_1',
    'Platform Administrator',
    'Slip #412 verified and approved.'
  );

  assert.equal(resolvedNotice?.status, 'RESOLVED');
  assert.equal(resolvedNotice?.resolutionNotes, 'Slip #412 verified and approved.');
});
