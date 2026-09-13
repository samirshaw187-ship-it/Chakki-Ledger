import assert from 'node:assert/strict';
import { ReportService } from '../report.service';

const revenueSummary = ReportService.getRevenueSummary();
assert.ok(revenueSummary.totalRevenue >= 0, 'Revenue summary should always return a numeric total.');
assert.ok(revenueSummary.series.length >= 1, 'Revenue summary should include time-series data.');

const profitSummary = ReportService.getGrossProfitSummary();
assert.ok(typeof profitSummary.grossProfit === 'number', 'Gross profit should be numeric.');

const purchaseSummary = ReportService.getRicePurchaseSummary();
assert.ok(purchaseSummary.totalQuantity >= 0, 'Rice purchase quantity should be numeric.');

const salesSummary = ReportService.getRiceSaleSummary();
assert.ok(salesSummary.totalQuantity >= 0, 'Rice sale quantity should be numeric.');

const customerActivity = ReportService.getCustomerActivityReport();
assert.ok(Array.isArray(customerActivity.items), 'Customer activity report should have an items array.');

console.log('report service smoke tests passed');
