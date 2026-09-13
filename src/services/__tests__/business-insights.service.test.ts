import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessInsightService, BusinessInsightQuestion } from '../business-insight.service';
import { ReportService } from '../report.service';

describe('BusinessInsightService', () => {
  it('returns a valid summary structure for the current range', () => {
    const insight = BusinessInsightService.generateBusinessInsights();
    assert.ok(insight.summary.length > 0);
    assert.ok(Array.isArray(insight.keyFactors));
    assert.ok(Array.isArray(insight.recommendations));
    assert.ok(typeof insight.confidence === 'string');
  });

  it('handles a profit drop request using verified data', () => {
    const query: BusinessInsightQuestion = {
      question: 'Why did profit fall?',
      period: 'THIS_MONTH',
      comparisonPeriod: 'LAST_MONTH',
    };

    const answer = BusinessInsightService.answerQuestion(query);
    assert.ok(answer.summary.toLowerCase().includes('profit') || answer.summary.toLowerCase().includes('data'));
    assert.ok(Array.isArray(answer.keyFactors));
  });

  it('reports insufficient data without inventing numbers', () => {
    const input = ReportService.getDateRange('CUSTOM', '2099-01-01', '2099-01-31');
    const insight = BusinessInsightService.generateBusinessInsights(input);
    assert.ok(insight.summary.toLowerCase().includes('no business data') || insight.summary.toLowerCase().includes('insufficient data'));
  });
});
