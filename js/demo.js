import { todayInZone, monthRange } from './domain.js';

export function demoData() {
  const today = todayInZone();
  const [year, month] = today.slice(0, 7).split('-').map(Number);
  const previous = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`;
  const current = today.slice(0, 7);
  const cafes = [
    { id: 'demo-cafe-1', name: 'Bloom на Патриарших', address: 'Москва, Малая Бронная, 18', timeZone: 'Europe/Moscow', openedOn: '2020-01-01', archived: false },
    { id: 'demo-cafe-2', name: 'Bloom в Хамовниках', address: 'Москва, Льва Толстого, 12', timeZone: 'Europe/Moscow', openedOn: '2020-01-01', archived: false },
    { id: 'demo-cafe-3', name: 'Bloom на Покровке', address: 'Москва, Покровка, 8', timeZone: 'Europe/Moscow', openedOn: '2020-01-01', archived: false }
  ];
  const categories = [
    { id: 'demo-category-1', name: 'Аренда', kind: 'operating', color: '#c77660', archived: false },
    { id: 'demo-category-2', name: 'Команда', kind: 'operating', color: '#d6ad75', archived: false },
    { id: 'demo-category-3', name: 'Коммунальные услуги', kind: 'operating', color: '#829b83', archived: false },
    { id: 'demo-category-4', name: 'Продукты и зерно', kind: 'raw', color: '#b98c74', archived: false },
    { id: 'demo-category-5', name: 'Оборудование', kind: 'capital', color: '#697f78', archived: false }
  ];
  const revenues = [], expenses = [], movements = [], costs = [];
  for (let index = 0; index < cafes.length; index++) {
    const cafe = cafes[index];
    for (const period of [previous, current]) {
      const end = period === current ? today : monthRange(period).to;
      for (let day = 1; day <= Number(end.slice(-2)); day++) {
        const date = `${period}-${String(day).padStart(2, '0')}`;
        const base = 1700000n + BigInt(index) * 220000n + BigInt(day % 7) * 85000n;
        const cash = base, card = base * 2n + BigInt(day % 3) * 40000n, delivery = 340000n + BigInt(index) * 25000n + BigInt(day % 5) * 30000n;
        revenues.push({ id: `demo-revenue-${index}-${date}`, cafeId: cafe.id, date, cash: String(cash), card: String(card), delivery: String(delivery), receipts: 78 + index * 9 + day % 17, comment: '' });
        for (const [source, amount] of [['cash', cash], ['card', card], ['delivery', delivery]]) movements.push({ id: `demo-movement-${index}-${date}-${source}`, cafeId: cafe.id, date, direction: 'in', source, amount: String(amount), expenseId: null, comment: 'Выручка смены' });
      }
      for (const [categoryIndex, day, amount] of [[0, 2, 21000000n], [1, 10, 32000000n], [2, 15, 2800000n], [3, 5, 14500000n], [4, 20, 5700000n]]) {
        const date = `${period}-${String(day).padStart(2, '0')}`;
        if (date > end) continue;
        const expenseId = `demo-expense-${index}-${date}-${categoryIndex}`;
        const value = String(amount + BigInt(index) * 500000n);
        expenses.push({ id: expenseId, cafeId: cafe.id, date, categoryId: categories[categoryIndex].id, amount: value, comment: '' });
        movements.push({ id: `demo-payment-${index}-${date}-${categoryIndex}`, cafeId: cafe.id, date, direction: 'out', source: 'card', amount: value, expenseId, comment: 'Оплата расхода' });
      }
      costs.push({ id: `demo-cost-${index}-${period}`, cafeId: cafe.id, month: period, amount: String(36000000n + BigInt(index) * 4000000n), expensesConfirmed: period === previous });
    }
  }
  return { cafes, categories, revenues, expenses, movements, costs };
}
