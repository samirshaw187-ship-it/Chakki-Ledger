import test from 'node:test';
import assert from 'node:assert/strict';
import { dbRepository } from '../../db/in-memory-db';
import { AuthService, isValidGmail, isValidPassword } from '../../modules/auth';
import { UserRole } from '../../types';

test('Email validation enforces @gmail.com format', () => {
  assert.equal(isValidGmail('test@gmail.com'), true);
  assert.equal(isValidGmail('owner.chakki@gmail.com'), true);
  assert.equal(isValidGmail('owner@yahoo.com'), false);
  assert.equal(isValidGmail('owner@hotmail.com'), false);
  assert.equal(isValidGmail('notanemail'), false);
  assert.equal(isValidGmail('owner@gmail.co'), false);
});

test('Password complexity enforces uppercase, lowercase, number, and symbol', () => {
  assert.equal(isValidPassword('Owner@1234').isValid, true);
  assert.equal(isValidPassword('Simple1234#').isValid, true);

  // Missing uppercase
  assert.equal(isValidPassword('owner@1234').isValid, false);
  // Missing lowercase
  assert.equal(isValidPassword('OWNER@1234').isValid, false);
  // Missing number
  assert.equal(isValidPassword('Owner@pass').isValid, false);
  // Missing symbol
  assert.equal(isValidPassword('Owner12345').isValid, false);
});

test('Shop Owner registration puts account in PENDING_APPROVAL and blocks immediate login', async () => {
  const regResult = await AuthService.registerShopOwner({
    name: 'Harish Bhai Chakki',
    phone: '9800099999',
    email: 'harish.chakki@gmail.com',
    address: 'Shop 10, Mandi Gate, Varanasi',
    password: 'Harish@2026#',
  });

  assert.equal(regResult.success, true);
  assert.equal(regResult.user?.approvalStatus, 'PENDING_APPROVAL');
  assert.equal(regResult.user?.isActive, false);

  // Attempt login with newly registered shop owner before Admin approval
  const loginAttempt = await AuthService.loginWithEmailPassword(
    'harish.chakki@gmail.com',
    'Harish@2026#',
    UserRole.OWNER
  );

  assert.equal(loginAttempt.success, false);
  assert.match(loginAttempt.error || '', /under review/i);
});

test('Admin can approve Shop Owner, which permits login', async () => {
  const user = dbRepository.getUserByEmail('harish.chakki@gmail.com');
  assert.ok(user);

  // Admin approves account
  dbRepository.updateUserApprovalStatus(user.id, 'APPROVED', 'Verified business credentials');
  assert.equal(user.approvalStatus, 'APPROVED');
  assert.equal(user.isActive, true);

  // Now login succeeds
  const loginAttempt = await AuthService.loginWithEmailPassword(
    'harish.chakki@gmail.com',
    'Harish@2026#',
    UserRole.OWNER
  );

  assert.equal(loginAttempt.success, true);
  assert.equal(loginAttempt.session?.user.email, 'harish.chakki@gmail.com');
});

test('Admin can suspend and deactivate Shop Owner', async () => {
  const user = dbRepository.getUserByEmail('harish.chakki@gmail.com');
  assert.ok(user);

  // Suspend
  dbRepository.updateUserApprovalStatus(user.id, 'SUSPENDED', 'Dispute over billing');
  assert.equal(user.approvalStatus, 'SUSPENDED');
  assert.equal(user.isActive, false);

  const loginSuspended = await AuthService.loginWithEmailPassword(
    'harish.chakki@gmail.com',
    'Harish@2026#',
    UserRole.OWNER
  );
  assert.equal(loginSuspended.success, false);
  assert.match(loginSuspended.error || '', /suspended/i);

  // Deactivate
  dbRepository.updateUserApprovalStatus(user.id, 'DEACTIVATED', 'Account closed');
  assert.equal(user.approvalStatus, 'DEACTIVATED');
  assert.equal(user.isActive, false);

  const loginDeactivated = await AuthService.loginWithEmailPassword(
    'harish.chakki@gmail.com',
    'Harish@2026#',
    UserRole.OWNER
  );
  assert.equal(loginDeactivated.success, false);
  assert.match(loginDeactivated.error || '', /deactivated/i);
});

test('Admin login with email and password succeeds', async () => {
  dbRepository.addUser({
    name: 'System Admin',
    email: 'admin@gmail.com',
    phone: '9999999999',
    role: UserRole.ADMIN,
    approvalStatus: 'APPROVED',
    isActive: true,
    password: 'Admin@1234',
  });

  const adminLogin = await AuthService.loginWithEmailPassword(
    'admin@gmail.com',
    'Admin@1234',
    UserRole.ADMIN
  );
  assert.equal(adminLogin.success, true);
  assert.equal(adminLogin.session?.role, UserRole.ADMIN);
});
