const DAY = 86400000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseMoney(input) {
  const text = String(input).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Введите корректную сумму');
  const [whole, fraction = ''] = text.split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}

export function formatMoney(minor, options = {}) {
  if (minor === null || minor === undefined) return 'Нет данных';
  const n = BigInt(minor);
  const negative = n < 0n;
  const absolute = negative ? -n : n;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${negative ? '−' : ''}${whole}${options.maximumFractionDigits === 0 ? '' : ',' + fraction}\u00a0₽`;
}

export function formatDate(date) {
  if (!datePattern.test(date)) return date;
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

export function todayInZone(zone = 'Europe/Moscow') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Некорректный месяц');
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

const dateValue = date => Date.parse(`${date}T00:00:00Z`);
const iso = time => new Date(time).toISOString().slice(0, 10);
const sum = (rows, fn) => rows.reduce((total, row) => total + BigInt(fn(row)), 0n);
const rounded = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
function percent(numerator, denominator) {
  if (denominator <= 0n) return null;
  const negative = numerator < 0n;
  const value = rounded((negative ? -numerator : numerator) * 10000n, denominator);
  return `${negative && value ? '-' : ''}${value / 100n}${value % 100n ? '.' + String(value % 100n).padStart(2, '0').replace(/0$/, '') : ''}`;
}
const revenueAmount = row => BigInt(row.cash) + BigInt(row.card) + BigInt(row.delivery);
const reportingEnd = cafe => {
  const today = todayInZone(cafe.timeZone);
  return cafe.archived && cafe.archivedOn && cafe.archivedOn < today ? cafe.archivedOn : today;
};

export function buildReport(data, filters) {
  const { from, to } = filters;
  const validDate = value => typeof value === 'string' && datePattern.test(value) && !value.startsWith('0000') && Number.isFinite(dateValue(value)) && iso(dateValue(value)) === value;
  if (!validDate(from) || !validDate(to) || dateValue(from) > dateValue(to)) throw new Error('Некорректный период');
  const cafes = data.cafes.filter(cafe => !filters.cafeIds?.length || filters.cafeIds.includes(cafe.id));
  const categories = new Map(data.categories.map(category => [category.id, category]));
  const inRange = row => row.date >= from && row.date <= to;
  const selected = new Set(cafes.map(cafe => cafe.id));
  const revenues = data.revenues.filter(row => selected.has(row.cafeId) && inRange(row));
  const expenses = data.expenses.filter(row => selected.has(row.cafeId) && inRange(row));
  const movements = data.movements.filter(row => selected.has(row.cafeId) && inRange(row));
  const byCategory = data.categories.filter(category => category.kind === 'operating').map(category => ({ id: category.id, name: category.name, color: category.color, amount: sum(expenses.filter(row => row.categoryId === category.id), row => row.amount).toString() })).filter(row => BigInt(row.amount) !== 0n);
  const missingCostMonths = [], unconfirmedMonths = [];
  function calculate(cafe, collect) {
    const cr = revenues.filter(row => row.cafeId === cafe.id);
    const ce = expenses.filter(row => row.cafeId === cafe.id);
    const cm = movements.filter(row => row.cafeId === cafe.id);
    const today = todayInZone(cafe.timeZone);
    const start = from > cafe.openedOn ? from : cafe.openedOn;
    const lastDay = reportingEnd(cafe);
    const end = to < lastDay ? to : lastDay;
    const days = new Set(cr.map(row => row.date));
    let missingDays = 0;
    for (let t = dateValue(start); t <= dateValue(end); t += DAY) if (!days.has(iso(t))) missingDays++;
    let cost = 0n, coverage = start <= end, confirmed = true;
    if (start <= end) {
      let month = start.slice(0, 7);
      const last = end.slice(0, 7);
      while (month <= last) {
        const range = monthRange(month);
        const row = data.costs.find(item => item.cafeId === cafe.id && item.month === month);
        const whole = from <= range.from && to >= range.to && today >= range.to;
        if (!row || !whole) {
          coverage = false;
          if (collect && !row) missingCostMonths.push({ cafeId: cafe.id, month });
        } else {
          cost += BigInt(row.amount);
        }
        if (row && !row.expensesConfirmed) {
          confirmed = false;
          if (collect) unconfirmedMonths.push({ cafeId: cafe.id, month });
        }
        const [year, number] = month.split('-').map(Number);
        month = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, '0')}`;
      }
    }
    const revenue = sum(cr, revenueAmount);
    const operating = sum(ce.filter(row => categories.get(row.categoryId)?.kind === 'operating'), row => row.amount);
    const cashIn = sum(cm.filter(row => row.direction === 'in'), row => row.amount);
    const cashOut = sum(cm.filter(row => row.direction === 'out'), row => row.amount);
    const complete = start <= end && !missingDays && coverage && confirmed;
    const receipts = cr.length && cr.every(row => row.receipts !== null) ? cr.reduce((total, row) => total + row.receipts, 0) : null;
    const gross = complete ? revenue - cost : null;
    const result = gross === null ? null : gross - operating;
    return { cafeId: cafe.id, name: cafe.name, revenue: revenue.toString(), operatingExpenses: operating.toString(), costOfGoods: coverage ? cost.toString() : null, grossResult: gross?.toString() ?? null, operatingResult: result?.toString() ?? null, cashFlow: (cashIn - cashOut).toString(), receipts, averageCheck: receipts > 0 ? rounded(revenue, BigInt(receipts)).toString() : null, margin: result === null ? null : percent(result, revenue), complete, missingDays };
  }
  const byCafe = cafes.map(cafe => calculate(cafe, true));
  const totalRevenue = sum(revenues, revenueAmount);
  const operatingExpenses = sum(expenses.filter(row => categories.get(row.categoryId)?.kind === 'operating'), row => row.amount);
  const rawPurchases = sum(expenses.filter(row => categories.get(row.categoryId)?.kind === 'raw'), row => row.amount);
  const capitalPurchases = sum(expenses.filter(row => categories.get(row.categoryId)?.kind === 'capital'), row => row.amount);
  const cashIn = sum(movements.filter(row => row.direction === 'in'), row => row.amount);
  const cashOut = sum(movements.filter(row => row.direction === 'out'), row => row.amount);
  const applicable = byCafe.filter(row => {
    const cafe = cafes.find(item => item.id === row.cafeId);
    return from <= reportingEnd(cafe) && to >= cafe.openedOn;
  });
  const coverage = applicable.length > 0 && applicable.every(row => row.costOfGoods !== null);
  const cost = coverage ? sum(applicable, row => row.costOfGoods) : null;
  const complete = applicable.length > 0 && applicable.every(row => row.complete);
  const gross = complete ? totalRevenue - cost : null;
  const result = gross === null ? null : gross - operatingExpenses;
  const receipts = revenues.length && revenues.every(row => row.receipts !== null) ? revenues.reduce((total, row) => total + row.receipts, 0) : null;
  const series = [];
  for (let time = dateValue(from); time <= dateValue(to); time += DAY) {
    const date = iso(time), dayRevenue = revenues.filter(row => row.date === date), dayExpenses = expenses.filter(row => row.date === date && categories.get(row.categoryId)?.kind === 'operating'), dayMovements = movements.filter(row => row.date === date);
    const applicableCafes = cafes.filter(cafe => cafe.openedOn <= date && date <= reportingEnd(cafe));
    const hasRevenue = applicableCafes.length > 0 && applicableCafes.every(cafe => dayRevenue.some(row => row.cafeId === cafe.id));
    series.push({ date, revenue: sum(dayRevenue, revenueAmount).toString(), expenses: sum(dayExpenses, row => row.amount).toString(), cashIn: sum(dayMovements.filter(row => row.direction === 'in'), row => row.amount).toString(), cashOut: sum(dayMovements.filter(row => row.direction === 'out'), row => row.amount).toString(), hasRevenue });
  }
  const length = Math.round((dateValue(to) - dateValue(from)) / DAY) + 1;
  const priorTo = dateValue(from) - DAY, priorFrom = priorTo - (length - 1) * DAY;
  let priorComplete = true;
  for (const cafe of cafes) {
    const end = Math.min(priorTo, dateValue(reportingEnd(cafe)));
    const start = Math.max(priorFrom, dateValue(cafe.openedOn));
    const dates = new Set(data.revenues.filter(row => row.cafeId === cafe.id).map(row => row.date));
    for (let t = start; t <= end; t += DAY) if (!dates.has(iso(t))) priorComplete = false;
    if (start > priorFrom || end < priorTo) priorComplete = false;
  }
  const prior = sum(data.revenues.filter(row => selected.has(row.cafeId) && row.date >= iso(priorFrom) && row.date <= iso(priorTo)), revenueAmount);
  return { revenue: totalRevenue.toString(), cash: sum(revenues, row => row.cash).toString(), card: sum(revenues, row => row.card).toString(), delivery: sum(revenues, row => row.delivery).toString(), operatingExpenses: operatingExpenses.toString(), rawPurchases: rawPurchases.toString(), capitalPurchases: capitalPurchases.toString(), costOfGoods: cost?.toString() ?? null, grossResult: gross?.toString() ?? null, operatingResult: result?.toString() ?? null, cashIn: cashIn.toString(), cashOut: cashOut.toString(), cashFlow: (cashIn - cashOut).toString(), receipts, averageCheck: receipts > 0 ? rounded(totalRevenue, BigInt(receipts)).toString() : null, margin: result === null ? null : percent(result, totalRevenue), missingDays: byCafe.reduce((total, row) => total + row.missingDays, 0), missingCostMonths, unconfirmedMonths, complete, previous: { revenue: priorComplete && cafes.length ? prior.toString() : null, changePercent: priorComplete && cafes.length && series.every(day => day.hasRevenue) && cafes.every(cafe => to <= todayInZone(cafe.timeZone)) ? percent(totalRevenue - prior, prior) : null }, series, byCategory, byCafe };
}
