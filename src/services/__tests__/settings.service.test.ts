import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SettingsService } from '../settings.service';
import { UserRole } from '../../types';

const owner = { id: 'usr-owner-test', name: 'Owner', role: UserRole.OWNER, phone: '9999999999' } as any;
const unauthorizedUser = { id: 'usr-unauthorized-test', name: 'Unauthorized', role: 'OPERATOR' as any, phone: '9999999998' } as any;

describe('SettingsService', () => {
  it('updates a rate for future transactions and logs the change', () => {
    const before = SettingsService.getActiveRates().rollAttaSellingRate;
    const updated = SettingsService.updateRate('rollAttaSellingRate', 42, owner, 'Set new roll atta retail rate');
    assert.equal(updated, 42);
    assert.ok(SettingsService.getRecentChanges().some((entry) => entry.setting === 'rollAttaSellingRate'));
    assert.equal(SettingsService.getActiveRates().rollAttaSellingRate, 42);
    SettingsService.updateRate('rollAttaSellingRate', before, owner, 'Reset for test');
  });

  it('rejects negative rates and unauthorized staff changes', () => {
    assert.throws(() => SettingsService.updateRate('ricePurchaseRate', -5, owner, 'Bad value'));
    assert.throws(() => SettingsService.updateRate('ricePurchaseRate', 23, unauthorizedUser, 'Unauthorized update'));
  });

  it('stores and returns the business profile and receipt settings', () => {
    const profile = SettingsService.updateBusinessProfile({ businessName: 'Chakki Ledger Test', phone: '9876543210' }, owner);
    const receipt = SettingsService.updateReceiptConfiguration({ footerText: 'Thanks for choosing us', receiptFormat: 'THERMAL' }, owner);
    assert.equal(profile.businessName, 'Chakki Ledger Test');
    assert.equal(receipt.footerText, 'Thanks for choosing us');
    assert.equal(SettingsService.getBusinessSettings().businessProfile.businessName, 'Chakki Ledger Test');
  });
});
