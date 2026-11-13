import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateUsage } from '../js/usage.js';
import { validateApplication } from '../js/applications.js';

const valid = { name: 'Анна', email: 'anna@example.test', company: '', useCase: 'Поиск по документации', model: '', volume: 'undecided', details: '', consent: true };

test('token estimate keeps input, output and total distinct', () => {
  assert.deepEqual(estimateUsage({ requestsPerDay: '100', inputTokens: '1000', outputTokens: '500', days: '30' }), { requests: '3000', input: '3000000', output: '1500000', total: '4500000' });
});

test('maximum supported load remains exact and zero output is allowed', () => {
  const result = estimateUsage({ requestsPerDay: '1000000', inputTokens: '10000000', outputTokens: '10000000', days: '31' });
  assert.equal(result.total, '620000000000000');
  assert.equal(estimateUsage({ requestsPerDay: '1', inputTokens: '1', outputTokens: '0', days: '1' }).total, '1');
});

test('invalid volume parameters do not produce a plausible estimate', () => {
  const baseline = { requestsPerDay: '100', inputTokens: '1000', outputTokens: '500', days: '30' };
  for (const value of ['', '1.5', '-1', '1e3', '1000001']) assert.throws(() => estimateUsage({ ...baseline, requestsPerDay: value }));
  assert.throws(() => estimateUsage({ ...baseline, days: '32' }));
  assert.throws(() => estimateUsage({ ...baseline, inputTokens: '0', outputTokens: '0' }));
});

test('independent developer can apply without a company or selected model', () => {
  const { data, errors } = validateApplication({ ...valid, name: ' Анна ', email: ' anna@example.test ' });
  assert.deepEqual(errors, {});
  assert.equal(data.name, 'Анна');
  assert.equal(data.email, 'anna@example.test');
  assert.equal(data.model, '');
});

test('application requires genuine contact, task and explicit local storage consent', () => {
  assert.ok(validateApplication({ ...valid, email: 'invalid' }).errors.email);
  assert.ok(validateApplication({ ...valid, useCase: ' ' }).errors.useCase);
  assert.ok(validateApplication({ ...valid, consent: 'true' }).errors.consent);
  assert.ok(validateApplication({ ...valid, name: '' }).errors.name);
});

test('application rejects forged model ids, unsupported volume and excessive payload', () => {
  assert.ok(validateApplication({ ...valid, model: '<script>bad</script>' }).errors.model);
  assert.ok(validateApplication({ ...valid, volume: 'unlimited' }).errors.volume);
  assert.ok(validateApplication({ ...valid, company: 'a'.repeat(121) }).errors.company);
  assert.ok(validateApplication({ ...valid, details: 'a'.repeat(2001) }).errors.details);
});
