import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMoney, monthRange, buildReport } from '../js/domain.js';

const filters = { from: '2024-02-01', to: '2024-02-29', cafeIds: [] };
function fixture() {
  return {
    cafes: [{ id: 'a', name: 'Первая', openedOn: '2024-01-01', timeZone: 'Europe/Moscow', archived: false }],
    categories: [{ id: 'op', name: 'Аренда', kind: 'operating' }, { id: 'raw', name: 'Зерно', kind: 'raw' }, { id: 'cap', name: 'Оборудование', kind: 'capital' }],
    revenues: Array.from({ length: 29 }, (_, index) => ({ id: `r${index}`, cafeId: 'a', date: `2024-02-${String(index + 1).padStart(2, '0')}`, cash: '10001', card: '20000', delivery: '9999', receipts: 100 })),
    expenses: [{ cafeId: 'a', date: '2024-02-10', categoryId: 'op', amount: '100000' }, { cafeId: 'a', date: '2024-02-11', categoryId: 'raw', amount: '150000' }, { cafeId: 'a', date: '2024-02-12', categoryId: 'cap', amount: '250000' }],
    movements: [{ cafeId: 'a', date: '2024-02-15', direction: 'in', amount: '450000' }, { cafeId: 'a', date: '2024-02-16', direction: 'out', amount: '150000' }],
    costs: [{ cafeId: 'a', month: '2024-02', amount: '200000', expensesConfirmed: true }]
  };
}

test('money parsing and formatting preserve cents beyond Number precision', () => {
  assert.equal(parseMoney('90 071 992 547 409,93'), '9007199254740993');
  assert.equal(formatMoney('9007199254740993'), '90\u00a0071\u00a0992\u00a0547\u00a0409,93\u00a0₽');
  assert.equal(parseMoney('0,01'), '1');
  for (const value of ['1.001', '-1', '1e3', '', 'NaN']) assert.throws(() => parseMoney(value));
});

test('leap-month result excludes raw purchases and equipment while cash flow uses movements', () => {
  assert.deepEqual(monthRange('2024-02'), { from: '2024-02-01', to: '2024-02-29' });
  const result = buildReport(fixture(), filters);
  assert.equal(result.revenue, '1160000');
  assert.equal(result.operatingExpenses, '100000');
  assert.equal(result.rawPurchases, '150000');
  assert.equal(result.capitalPurchases, '250000');
  assert.equal(result.grossResult, '960000');
  assert.equal(result.operatingResult, '860000');
  assert.equal(result.cashFlow, '300000');
  assert.equal(result.averageCheck, '400');
  assert.equal(result.complete, true);
  assert.deepEqual(result.byCategory.map(row => row.id), ['op']);
});

test('missing day is not a zero day and blocks a complete financial result', () => {
  const data = fixture(); data.revenues.splice(5, 1);
  const result = buildReport(data, filters);
  assert.equal(result.missingDays, 1);
  assert.equal(result.operatingResult, null);
  assert.equal(result.series[5].hasRevenue, false);
});

test('unknown receipt count suppresses average, explicit zero revenue remains observed', () => {
  const data = fixture();
  Object.assign(data.revenues[0], { cash: '0', card: '0', delivery: '0', receipts: null });
  const result = buildReport(data, filters);
  assert.equal(result.averageCheck, null);
  assert.equal(result.series[0].hasRevenue, true);
  assert.equal(result.missingDays, 0);
});

test('average receipt rounds half up using integer arithmetic', () => {
  const data = fixture();
  data.revenues = [{ cafeId: 'a', date: '2024-02-01', cash: '101', card: '0', delivery: '0', receipts: 2 }];
  assert.equal(buildReport(data, filters).averageCheck, '51');
});

test('missing cost differs from explicit zero and partial months are never prorated', () => {
  const data = fixture(); data.costs[0].amount = '0';
  assert.equal(buildReport(data, filters).costOfGoods, '0');
  assert.equal(buildReport(data, filters).complete, true);
  assert.equal(buildReport(data, { ...filters, to: '2024-02-15' }).costOfGoods, null);
  assert.equal(buildReport(data, { ...filters, to: '2024-02-15' }).missingCostMonths.length, 0);
  data.costs = [];
  assert.equal(buildReport(data, filters).operatingResult, null);
});

test('unconfirmed operating expenses prevent complete result', () => {
  const data = fixture(); data.costs[0].expensesConfirmed = false;
  const result = buildReport(data, filters);
  assert.equal(result.operatingResult, null);
  assert.equal(result.unconfirmedMonths.length, 1);
});

test('network chart gaps when one applicable cafe is missing; selection isolates it', () => {
  const data = fixture(); data.cafes.push({ ...data.cafes[0], id: 'b', name: 'Вторая' });
  assert.equal(buildReport(data, filters).series[0].hasRevenue, false);
  assert.equal(buildReport(data, filters).operatingResult, null);
  assert.equal(buildReport(data, { ...filters, cafeIds: ['a'] }).operatingResult, '860000');
});

test('new cafes require reports only since opening, including a midmonth first month', () => {
  const data = fixture(); data.cafes[0].openedOn = '2024-02-15';
  data.revenues = data.revenues.filter(row => row.date >= '2024-02-15');
  data.expenses = [];
  const result = buildReport(data, filters);
  assert.equal(result.missingDays, 0);
  assert.equal(result.complete, true);
  assert.equal(result.operatingResult, '400000');
});

test('no cafes and impossible date ranges do not become valid zero-profit reports', () => {
  const data = fixture(); data.cafes = []; data.revenues = []; data.expenses = []; data.movements = [];
  const result = buildReport(data, filters);
  assert.equal(result.complete, false);
  assert.equal(result.operatingResult, null);
  assert.throws(() => buildReport(data, { ...filters, from: '2024-02-30' }));
  assert.throws(() => buildReport(data, { ...filters, from: '2024-03-01' }));
});

test('percentage change requires full current and previous revenue coverage', () => {
  const data = fixture();
  const result = buildReport(data, filters);
  assert.equal(result.previous.changePercent, null);
  const short = { from: '2024-02-03', to: '2024-02-04', cafeIds: [] };
  assert.equal(buildReport(data, short).previous.changePercent, '0');
  data.revenues = data.revenues.filter(row => row.date !== '2024-02-03');
  assert.equal(buildReport(data, short).previous.changePercent, null);
});

test('archived cafe keeps history without demanding revenue after its archive date', () => {
  const data = fixture();
  Object.assign(data.cafes[0], { archived: true, archivedOn: '2024-02-10' });
  data.revenues = data.revenues.filter(row => row.date <= '2024-02-10');
  const result = buildReport(data, filters);
  assert.equal(result.missingDays, 0);
  assert.equal(result.complete, true);
  assert.equal(result.revenue, '400000');
  assert.equal(result.operatingResult, '100000');
  const later = buildReport(data, { from: '2024-03-01', to: '2024-03-31', cafeIds: [] });
  assert.equal(later.missingDays, 0);
  assert.equal(later.complete, false);
});
