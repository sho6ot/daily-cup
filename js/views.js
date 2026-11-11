import { formatMoney, formatDate, todayInZone } from './domain.js';
import { escape, icon } from './ui.js';

const e = escape;
const money = value => value == null ? 'Нет данных' : formatMoney(value);
const date = value => value ? formatDate(value) : 'Нет данных';
const button = (label, action, kind, extra = '') => `<button type="button" class="button button--${action === 'create' ? 'primary' : 'secondary'} button--small" data-action="${action}"${kind ? ` data-kind="${kind}"` : ''}${extra}>${action === 'create' ? icon('plus', 16) : ''}${label}</button>`;
const create = (kind, label) => button(label, 'create', kind);
const link = (route, label) => `<a class="button button--ghost button--small" href="#/${route}">${label} ${icon('arrow-right', 16)}</a>`;
const actions = (kind, row) => { const description = `${{ revenue: 'выручку', expense: 'расход', movement: 'движение', cost: 'себестоимость' }[kind] || 'запись'} ${row.date || row.month || ''} ${row.id}`; return `<div class="row-actions"><button type="button" class="icon-button" data-action="edit" data-kind="${kind}" data-id="${e(row.id)}" aria-label="Изменить ${e(description)}">${icon('edit', 17)}</button><button type="button" class="icon-button" data-action="delete" data-kind="${kind}" data-id="${e(row.id)}" aria-label="Удалить ${e(description)}">${icon('trash', 17)}</button></div>`; };
const empty = (title, text, action = '') => `<div class="empty-state"><div class="empty-state__icon">${icon('receipt', 24)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
const panel = (title, content, action = '') => `<section class="panel"><div class="panel__header"><h2 class="panel__title">${title}</h2>${action}</div><div class="panel__body">${content}</div></section>`;
const cell = (label, value) => `<td data-label="${label}">${value}</td>`;
const table = (headers, rows) => `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const cafeName = (data, id) => data.cafes.find(x => x.id === id)?.name ?? 'Неизвестная кофейня';
const categoryName = (data, id) => data.categories.find(x => x.id === id)?.name ?? 'Неизвестная категория';
const categoryKinds = { operating: 'Операционные', raw: 'Закупка сырья', capital: 'Капитальные' };
const sources = { cash: 'Наличные', card: 'Карта', delivery: 'Доставка', other: 'Другое' };
const selectedRows = (rows, filters, dateKey = 'date') => rows.filter(row => (!filters.from || row[dateKey] >= filters.from) && (!filters.to || row[dateKey] <= filters.to) && (!filters.cafeIds?.length || filters.cafeIds.includes(row.cafeId)));
const sortDate = (a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
const kpi = (label, value, meta, accent = false) => `<article class="kpi-card${accent ? ' kpi-card--accent' : ''}"><p class="kpi-card__label">${label}</p><p class="kpi-card__value">${value}</p><p class="kpi-card__meta">${meta}</p></article>`;

export function renderAuth(mode = 'login') {
  const register = mode === 'register';
  return `<main id="main" tabindex="-1" class="auth-layout"><section class="auth-story"><div class="auth-brand">${icon('bloom', 30)} <span>Bloom</span></div><div class="auth-orbit" aria-hidden="true">${icon('bloom', 80)}</div><div><p class="eyebrow">ФИНАНСЫ ВАШЕГО БИЗНЕСА</p><h1>Ясность в каждом решении.</h1><p>Выручка, расходы и движение денег ваших кофеен в одном спокойном пространстве.</p></div><p class="auth-footnote">Данные хранятся в этом браузере. Локальный вход не заменяет защиту устройства.</p></section><section class="auth-card"><div class="auth-card__inner"><div class="auth-brand">${icon('bloom', 28)} <span>Bloom</span></div><p class="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p><h2>${register ? 'Создать аккаунт' : 'Рады видеть вас снова'}</h2><p class="text-muted">${register ? 'Создайте пространство для ваших кофеен.' : 'Войдите в своё рабочее пространство.'}</p><form id="auth-form" class="auth-form" data-mode="${register ? 'register' : 'login'}">${register ? `<label class="field"><span class="field__label">Ваше имя</span><input name="name" autocomplete="name" required maxlength="100"></label><label class="field"><span class="field__label">Название организации</span><input name="organizationName" autocomplete="organization" required maxlength="100"></label>` : ''}<label class="field"><span class="field__label">Электронная почта</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span class="field__label">Пароль</span><input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required></label><p class="auth-error" role="alert" hidden></p><button class="button button--primary" type="submit">${register ? 'Создать аккаунт' : 'Войти'} ${icon('arrow-right', 18)}</button></form><p class="auth-switch">${register ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'} <button type="button" class="button button--ghost" data-action="auth-mode" data-mode="${register ? 'login' : 'register'}">${register ? 'Войти' : 'Зарегистрироваться'}</button></p><div class="auth-divider"><span>или</span></div><button type="button" class="button button--secondary" data-action="demo">Посмотреть демо</button><p class="auth-footnote">Данные хранятся в этом браузере и доступны только на этом устройстве.</p></div></section></main>`;
}

function chart(report) {
  const series = report.series || [];
  if (!series.length) return empty('Пока нет данных', 'Добавьте выручку и расходы, чтобы увидеть динамику.');
  const values = series.flatMap(s => [BigInt(s.revenue || '0'), BigInt(s.expenses || '0')]);
  const max = values.reduce((a, b) => b > a ? b : a, 0n) || 1n;
  const x = i => series.length === 1 ? 330 : 100 + i * 470 / (series.length - 1);
  const y = n => 190 - Number(BigInt(n || '0') * 15000n / max) / 100;
  const paths = (key, observed) => {
    let result = '', segment = [];
    const flush = () => { if (segment.length) result += `<polyline class="chart__line chart__line--${key}" points="${segment.join(' ')}" fill="none" stroke="${key === 'revenue' ? '#be7056' : '#718b78'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`; segment = []; };
    series.forEach((s, i) => { if (observed(s)) segment.push(`${x(i)},${y(s[key])}`); else flush(); }); flush(); return result;
  };
  const points = (key, observed, label, color) => series.map((s, i) => observed(s) ? `<circle cx="${x(i)}" cy="${y(s[key])}" r="3" fill="${color}" tabindex="0"><title>${e(date(s.date))}: ${label} ${e(money(s[key]))}</title></circle>` : '').join('');
  const axis = [0, 1, 2, 3].map(i => { const value = max * BigInt(3 - i) / 3n; const pos = 40 + i * 50; return `<path d="M100 ${pos}H570" stroke="#ebe9e2"/><text x="94" y="${pos + 4}" text-anchor="end" font-size="9" fill="#6d756e">${e(money(value.toString()))}</text>`; }).join('');
  const count = Math.min(5, series.length);
  const ticks = [...new Set(Array.from({ length: count }, (_, i) => count === 1 ? 0 : Math.round(i * (series.length - 1) / (count - 1))))].map(i => `<text x="${x(i)}" y="210" text-anchor="middle" font-size="9" fill="#6d756e">${e(date(series[i].date))}</text>`).join('');
  return `<div class="chart"><svg viewBox="0 0 600 220" role="img" aria-labelledby="chart-title"><title id="chart-title">Динамика выручки и операционных расходов за выбранный период, суммы в рублях</title>${axis}${ticks}${paths('revenue', s => s.hasRevenue)}${paths('expenses', () => true)}${points('revenue', s => s.hasRevenue, 'выручка', '#be7056')}${points('expenses', () => true, 'операционные расходы', '#718b78')}</svg><div class="chart-legend"><span class="chart-legend__item"><i class="legend-dot legend-dot--revenue"></i>Выручка</span><span class="chart-legend__item"><i class="legend-dot legend-dot--expense"></i>Операционные расходы</span></div><p class="text-muted">Разрывы линии выручки означают дни без записи.</p><details><summary>Данные по дням</summary>${table(['Дата', 'Выручка', 'Операционные расходы'], series.map(s => `<tr>${cell('Дата', date(s.date))}${cell('Выручка', s.hasRevenue ? money(s.revenue) : 'Нет записи')}${cell('Операционные расходы', money(s.expenses))}</tr>`))}</details></div>`;
}

function mix(report) {
  const rows = (report.byCategory || []).filter(x => BigInt(x.amount || '0') > 0n);
  if (!rows.length) return empty('Расходов пока нет', 'Добавьте операционные расходы, чтобы увидеть их структуру.');
  const total = rows.reduce((sum, row) => sum + BigInt(row.amount), 0n);
  let offset = 0;
  const arcs = rows.map((r, i) => { const part = Number(BigInt(r.amount) * 10000n / total) / 100; const result = `<circle cx="50" cy="50" r="40" fill="none" stroke="${/^#[0-9a-f]{6}$/i.test(r.color || '') ? e(r.color) : ['#bd7055', '#8ca58e', '#d2b580', '#a29b8d'][i % 4]}" stroke-width="12" pathLength="100" stroke-dasharray="${part} ${100 - part}" stroke-dashoffset="${-offset}"/>`; offset += part; return result; }).join('');
  return `<div class="donut-layout"><svg viewBox="0 0 100 100" role="img" aria-labelledby="mix-title"><title id="mix-title">Структура операционных расходов по категориям</title><g transform="rotate(-90 50 50)">${arcs}</g></svg><div class="category-list">${rows.map(r => `<div class="category-row"><span><i class="color-dot" style="background:${/^#[0-9a-f]{6}$/i.test(r.color || '') ? e(r.color) : '#8ca58e'}"></i>${e(r.name)}</span><strong>${money(r.amount)}</strong></div>`).join('')}</div></div>`;
}

function completeness(report) {
  const missingCosts = report.missingCostMonths?.length || 0, unconfirmed = report.unconfirmedMonths?.length || 0;
  return `<div class="insight${report.complete ? '' : ' insight--warning'}">${icon(report.complete ? 'check' : 'info', 20)}<div><strong>${report.complete ? 'Данные заполнены' : 'Результат пока неполный'}</strong><p>${report.complete ? 'Выручка и себестоимость заполнены, расходы подтверждены.' : `Нет записей выручки за дней: ${report.missingDays || 0}. Нет себестоимости за месяцев: ${missingCosts}. Не подтверждены расходы за месяцев: ${unconfirmed}. Для расчёта результата необходимы полные календарные месяцы.`}</p>${link('costs', 'Проверить себестоимость')}</div></div>`;
}

function comparison(report, preview = false) {
  const rows = report.byCafe || [];
  if (!rows.length) return empty('Нет кофеен для сравнения', 'Добавьте кофейню и финансовые данные.', create('cafe', 'Добавить кофейню'));
  return table(preview ? ['Кофейня', 'Выручка', 'Операционный результат', 'Движение денег', 'Данные'] : ['Кофейня', 'Выручка', 'Операционные расходы', 'Себестоимость', 'Операционный результат', 'Средний чек', 'Маржа', 'Движение денег', 'Данные'], (preview ? rows.slice(0, 4) : rows).map(r => `<tr>${cell('Кофейня', `<strong>${e(r.name)}</strong>`)}${cell('Выручка', money(r.revenue))}${preview ? '' : cell('Операционные расходы', money(r.operatingExpenses)) + cell('Себестоимость', money(r.costOfGoods))}${cell('Операционный результат', money(r.operatingResult))}${preview ? '' : cell('Средний чек', money(r.averageCheck)) + cell('Маржа', r.margin == null ? 'Нет данных' : `${e(r.margin)}%`)}${cell('Движение денег', money(r.cashFlow))}${cell('Данные', `<span class="badge badge--${r.complete ? 'success' : 'warning'}">${r.complete ? 'Заполнены' : 'Неполные'}</span>`)}</tr>`));
}

function overview({ report, data }) {
  if (!data.cafes.length) return panel('Начните работу с Bloom', empty('Добавьте первую кофейню', 'Создайте кофейню, затем внесите выручку и расходы. Здесь появится понятная картина вашего бизнеса.', create('cafe', 'Добавить кофейню')));
  const change = report.previous?.changePercent == null ? 'Нет полного предыдущего периода' : `${e(report.previous.changePercent)}% к предыдущему периоду`;
  return `<div class="kpi-grid">${kpi('Выручка', money(report.revenue), change, true)}${kpi('Операционные расходы', money(report.operatingExpenses), 'Без закупок сырья и капитальных расходов')}${kpi('Операционный результат', money(report.operatingResult), report.complete ? 'Выручка за вычетом себестоимости и расходов' : 'Нужны полные данные')}${kpi('Движение денег', money(report.cashFlow), 'Поступления за вычетом выплат')}</div><div class="dashboard-grid">${panel('Динамика за период', chart(report))}${panel('Структура расходов', mix(report))}${panel('Кофейни', comparison(report, true), link('compare', 'Все кофейни'))}${panel('Полнота данных', completeness(report))}</div>`;
}

function revenuePage(ctx) {
  const rows = selectedRows(ctx.data.revenues, ctx.filters).sort(sortDate);
  const body = rows.length ? table(['Дата', 'Кофейня', 'Наличные', 'Карта', 'Доставка', 'Чеки', 'Действия'], rows.map(r => `<tr>${cell('Дата', date(r.date))}${cell('Кофейня', e(cafeName(ctx.data, r.cafeId)))}${cell('Наличные', money(r.cash))}${cell('Карта', money(r.card))}${cell('Доставка', money(r.delivery))}${cell('Чеки', r.receipts == null ? 'Нет данных' : e(r.receipts))}${cell('Действия', actions('revenue', r))}</tr>`)) : empty('Записей выручки нет', 'Добавьте выручку за день для выбранной кофейни.', create('revenue', 'Добавить выручку'));
  return `<div class="kpi-grid">${kpi('Выручка', money(ctx.report.revenue), 'За выбранный период', true)}${kpi('Наличные', money(ctx.report.cash), 'Выручка наличными')}${kpi('Карта', money(ctx.report.card), 'Оплата картой')}${kpi('Доставка', money(ctx.report.delivery), 'Выручка от доставки')}</div><p class="insight">Средний чек: <strong>${money(ctx.report.averageCheck)}</strong>. Для расчёта укажите количество чеков во всех записях выручки.</p>${panel('Записи выручки', body, create('revenue', 'Добавить выручку'))}`;
}

function expensesPage(ctx) {
  const rows = selectedRows(ctx.data.expenses, ctx.filters).sort(sortDate);
  const body = rows.length ? table(['Дата', 'Кофейня', 'Категория', 'Комментарий', 'Сумма', 'Действия'], rows.map(r => `<tr>${cell('Дата', date(r.date))}${cell('Кофейня', e(cafeName(ctx.data, r.cafeId)))}${cell('Категория', e(categoryName(ctx.data, r.categoryId)))}${cell('Комментарий', e(r.comment || '–'))}${cell('Сумма', money(r.amount))}${cell('Действия', actions('expense', r))}</tr>`)) : empty('Расходов пока нет', 'Добавьте расход и укажите его категорию.', create('expense', 'Добавить расход'));
  return `<div class="kpi-grid">${kpi('Операционные расходы', money(ctx.report.operatingExpenses), 'Учитываются в операционном результате', true)}${kpi('Закупки сырья', money(ctx.report.rawPurchases), 'Не равны себестоимости')}${kpi('Капитальные расходы', money(ctx.report.capitalPurchases), 'Не входят в операционный результат')}</div><p class="insight">Расход и выплата денег учитываются отдельно. Связанную выплату можно добавить в разделе «Деньги».</p>${panel('Расходы', body, create('expense', 'Добавить расход'))}`;
}

function moneyPage(ctx) {
  const rows = selectedRows(ctx.data.movements, ctx.filters).sort(sortDate);
  const body = rows.length ? table(['Дата', 'Кофейня', 'Направление', 'Источник', 'Связанный расход', 'Сумма', 'Действия'], rows.map(r => `<tr>${cell('Дата', date(r.date))}${cell('Кофейня', e(cafeName(ctx.data, r.cafeId)))}${cell('Направление', r.direction === 'in' ? 'Поступление' : 'Выплата')}${cell('Источник', e(sources[r.source] || r.source))}${cell('Связанный расход', r.expenseId ? e(categoryName(ctx.data, ctx.data.expenses.find(x => x.id === r.expenseId)?.categoryId)) : '–')}${cell('Сумма', `<span class="amount amount--${r.direction === 'in' ? 'positive' : 'negative'}">${r.direction === 'in' ? '+' : '−'} ${money(r.amount)}</span>`)}${cell('Действия', actions('movement', r))}</tr>`)) : empty('Движений денег нет', 'Добавьте поступление или выплату.', create('movement', 'Добавить движение'));
  return `<div class="kpi-grid">${kpi('Поступления', money(ctx.report.cashIn), 'Фактические движения', true)}${kpi('Выплаты', money(ctx.report.cashOut), 'Фактические движения')}${kpi('Денежный поток', money(ctx.report.cashFlow), 'Поступления минус выплаты')}</div><p class="insight">Движение денег не рассчитывается из выручки и расходов. Записывайте фактические поступления и выплаты отдельно.</p>${panel('Движение денег', body, create('movement', 'Добавить движение'))}`;
}

function costsPage(ctx) {
  const rows = ctx.data.costs.filter(r => (!ctx.filters.cafeIds?.length || ctx.filters.cafeIds.includes(r.cafeId)) && (!ctx.filters.from || `${r.month}-31` >= ctx.filters.from) && (!ctx.filters.to || `${r.month}-01` <= ctx.filters.to)).sort((a,b) => b.month.localeCompare(a.month));
  const body = rows.length ? table(['Месяц', 'Кофейня', 'Себестоимость', 'Расходы', 'Действия'], rows.map(r => `<tr>${cell('Месяц', e(r.month))}${cell('Кофейня', e(cafeName(ctx.data, r.cafeId)))}${cell('Себестоимость', money(r.amount))}${cell('Расходы', `<span class="badge badge--${r.expensesConfirmed ? 'success' : 'warning'}">${r.expensesConfirmed ? 'Подтверждены' : 'Не подтверждены'}</span>`)}${cell('Действия', actions('cost', r))}</tr>`)) : empty('Себестоимость не заполнена', 'Добавьте себестоимость за полный календарный месяц и подтвердите расходы.', create('cost', 'Добавить месяц'));
  return `${completeness(ctx.report)}<p class="text-muted">Себестоимость вводится за календарный месяц и не распределяется по дням. Для расчёта результата выберите полные месяцы. Закупки сырья не заменяют себестоимость.</p>${panel('Себестоимость по месяцам', body, create('cost', 'Добавить месяц'))}`;
}

function historyPage(ctx) {
  const { data, filters } = ctx;
  const type = filters.type || 'all', search = String(filters.search || '').trim().toLocaleLowerCase('ru'), category = filters.categoryId || '';
  const entries = [ ...data.revenues.map(r => ({ ...r, kind: 'revenue', label: 'Выручка', value: (BigInt(r.cash) + BigInt(r.card) + BigInt(r.delivery)).toString() })), ...data.expenses.map(r => ({ ...r, kind: 'expense', label: 'Расход', value: r.amount })), ...data.movements.map(r => ({ ...r, kind: 'movement', label: r.direction === 'in' ? 'Поступление' : 'Выплата', value: r.amount })) ];
  const rows = selectedRows(entries, filters).filter(r => (type === 'all' || r.kind === type) && (!category || r.categoryId === category) && (!search || [r.label, cafeName(data, r.cafeId), r.categoryId ? categoryName(data, r.categoryId) : '', r.comment || '', r.date].some(v => String(v).toLocaleLowerCase('ru').includes(search)))).sort(sortDate);
  const body = rows.length ? table(['Дата', 'Тип', 'Кофейня', 'Категория / комментарий', 'Сумма', 'Действия'], rows.map(r => `<tr>${cell('Дата', date(r.date))}${cell('Тип', r.label)}${cell('Кофейня', e(cafeName(data, r.cafeId)))}${cell('Категория / комментарий', `${r.categoryId ? e(categoryName(data, r.categoryId)) : '–'}${r.comment ? `<div class="cell-note">${e(r.comment)}</div>` : ''}`)}${cell('Сумма', money(r.value))}${cell('Действия', actions(r.kind, r))}</tr>`)) : empty('Операции не найдены', 'Попробуйте изменить фильтры или добавьте запись.');
  return `<form id="history-filters" class="filter-form"><label class="field search-field"><span class="field__label">Поиск</span><input type="search" name="search" value="${e(filters.search || '')}" placeholder="Кофейня, категория, комментарий"></label><label class="field"><span class="field__label">Тип</span><select name="type">${[['all','Все операции'],['revenue','Выручка'],['expense','Расходы'],['movement','Движение денег']].map(([v,l]) => `<option value="${v}"${type === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="field"><span class="field__label">Категория</span><select name="categoryId"><option value="">Все категории</option>${data.categories.map(c => `<option value="${e(c.id)}"${category === c.id ? ' selected' : ''}>${e(c.name)}</option>`).join('')}</select></label><button type="submit" class="button button--secondary">Применить</button></form>${panel('История операций', body, `<button type="button" class="button button--secondary button--small" data-action="export" data-export="operations">${icon('download', 16)} Экспорт</button>`)}`;
}

function settingsPage({ data, session }) {
  const cafes = data.cafes.length ? `<div class="cafe-list">${data.cafes.map(c => `<article class="cafe-tile"><div><strong>${e(c.name)}</strong><p class="cell-note">${e(c.address || 'Адрес не указан')} · ${e(c.timeZone)}${c.archived ? ' · В архиве' : ''}</p></div><div class="row-actions"><button type="button" class="icon-button" data-action="edit" data-kind="cafe" data-id="${e(c.id)}" aria-label="Изменить кофейню">${icon('edit', 17)}</button>${button(c.archived ? 'Вернуть' : 'В архив', 'archive', 'cafe', ` data-id="${e(c.id)}" data-archived="${!c.archived}"`)}</div></article>`).join('')}</div>` : empty('Кофеен пока нет', 'Добавьте первую кофейню для учёта.', create('cafe', 'Добавить кофейню'));
  const categories = data.categories.length ? `<div class="category-list">${data.categories.map(c => `<div class="category-row"><span><i class="color-dot" style="background:${/^#[0-9a-f]{6}$/i.test(c.color || '') ? e(c.color) : '#8ca58e'}"></i><strong>${e(c.name)}</strong> <span class="cell-note">${e(categoryKinds[c.kind] || c.kind)}${c.archived ? ' · В архиве' : ''}</span></span><span class="row-actions"><button type="button" class="icon-button" data-action="edit" data-kind="category" data-id="${e(c.id)}" aria-label="Изменить категорию">${icon('edit', 17)}</button>${button(c.archived ? 'Вернуть' : 'В архив', 'archive', 'category', ` data-id="${e(c.id)}" data-archived="${!c.archived}"`)}</span></div>`).join('')}</div>` : empty('Категорий нет', 'Добавьте категорию расходов.', create('category', 'Добавить категорию'));
  return `<div class="settings-grid">${panel('Организация', `<p class="cell-title">${e(data.organization.name)}</p><p class="text-muted">Валюта учёта: RUB</p>`, button('Изменить', 'edit', 'organization', ` data-id="${e(data.organization.id)}"`))}${panel('Профиль', `<p class="cell-title">${e(session.name)}</p><p class="text-muted">${e(session.email)}</p><p class="text-muted">Аккаунт и данные доступны в этом браузере. Защитите доступ к устройству.</p>`, session.demo ? '' : button('Изменить пароль', 'create', 'password'))}${panel('Кофейни', cafes, create('cafe', 'Добавить'))}${panel('Категории расходов', categories, create('category', 'Добавить'))}</div>`;
}

export function renderPage(route, ctx) {
  switch (route) {
    case 'overview': return overview(ctx);
    case 'revenue': return revenuePage(ctx);
    case 'expenses': return expensesPage(ctx);
    case 'money': return moneyPage(ctx);
    case 'costs': return costsPage(ctx);
    case 'history': return historyPage(ctx);
    case 'compare': return `${completeness(ctx.report)}${panel('Сравнение кофеен', comparison(ctx.report), `<button type="button" class="button button--secondary button--small" data-action="export" data-export="comparison">${icon('download', 16)} Экспорт</button>`)}<p class="text-muted">Операционный результат доступен только при полном заполнении данных за выбранный период.</p>`;
    case 'settings': return settingsPage(ctx);
    default: return empty('Страница не найдена', 'Перейдите к обзору.', link('overview', 'Открыть обзор'));
  }
}

function humanMoney(value) {
  if (value == null || value === '') return '';
  const n = BigInt(value), abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`;
}
const input = (name, label, value = '', attrs = '', hint = '') => `<label class="field"><span class="field__label">${label}</span><input name="${name}" value="${e(value ?? '')}" ${attrs}>${hint ? `<span class="field__hint">${hint}</span>` : ''}</label>`;
const select = (name, label, options, value, hint = '') => `<label class="field"><span class="field__label">${label}</span><select name="${name}" required>${options.map(([v,l]) => `<option value="${e(v)}"${String(value ?? '') === String(v) ? ' selected' : ''}>${e(l)}</option>`).join('')}</select>${hint ? `<span class="field__hint">${hint}</span>` : ''}</label>`;
const amountInput = (name, label, value, required = true) => input(name, label, humanMoney(value), `type="text" inputmode="decimal" ${required ? 'required' : ''} placeholder="0,00"`, 'Сумма в рублях');
const commentInput = value => `<label class="field field--full"><span class="field__label">Комментарий</span><textarea name="comment" rows="3">${e(value || '')}</textarea></label>`;

export function renderForm(kind, record = null, ctx) {
  const r = record || {}, data = ctx.data;
  const cafes = data.cafes.filter(c => !c.archived || c.id === r.cafeId).map(c => [c.id, `${c.name}${c.archived ? ' (архив)' : ''}`]);
  const categories = data.categories.filter(c => !c.archived || c.id === r.categoryId).map(c => [c.id, `${c.name}${c.archived ? ' (архив)' : ''}`]);
  const cafe = () => select('cafeId', 'Кофейня', [['', 'Выберите кофейню'], ...cafes], r.cafeId);
  const day = () => input('date', 'Дата', r.date || todayInZone(), 'type="date" required');
  let title, body;
  switch (kind) {
    case 'cafe': title = r.id ? 'Изменить кофейню' : 'Новая кофейня'; body = input('name', 'Название', r.name, 'required maxlength="100"') + input('address', 'Адрес', r.address, 'maxlength="250"') + input('timeZone', 'Часовой пояс', r.timeZone || 'Europe/Moscow', 'required', 'Например, Europe/Moscow') + input('openedOn', 'Дата открытия', r.openedOn || todayInZone(), 'type="date" required'); break;
    case 'category': title = r.id ? 'Изменить категорию' : 'Новая категория'; body = input('name', 'Название', r.name, 'required maxlength="100"') + select('kind', 'Тип категории', Object.entries(categoryKinds), r.kind || 'operating', 'Тип исторической категории нельзя изменить после использования.') + input('color', 'Цвет', r.color || '#8ca58e', 'type="color" required'); break;
    case 'revenue': title = r.id ? 'Изменить выручку' : 'Добавить выручку'; body = cafe() + day() + `<p class="field__hint field--full">Указывайте каждый платёж только в одном канале: доставка не должна повторяться в наличных или карте.</p>` + amountInput('cash', 'Наличные', r.cash ?? '0') + amountInput('card', 'Карта', r.card ?? '0') + amountInput('delivery', 'Доставка', r.delivery ?? '0') + input('receipts', 'Количество чеков', r.receipts, 'type="number" min="0" step="1"', 'Необязательно; нужно для среднего чека') + commentInput(r.comment); break;
    case 'expense': title = r.id ? 'Изменить расход' : 'Добавить расход'; body = cafe() + day() + `<p class="field__hint field--full">Укажите дату признания расхода. Дату фактической выплаты можно записать отдельно в разделе «Деньги».</p>` + select('categoryId', 'Категория', [['', 'Выберите категорию'], ...categories], r.categoryId) + amountInput('amount', 'Сумма', r.amount) + commentInput(r.comment); break;
    case 'movement': title = r.id ? 'Изменить движение' : 'Добавить движение денег'; body = cafe() + day() + select('direction', 'Направление', [['in', 'Поступление'], ['out', 'Выплата']], r.direction || 'in') + select('source', 'Источник', Object.entries(sources), r.source || 'cash') + amountInput('amount', 'Сумма', r.amount) + `<label class="field"><span class="field__label">Связанный расход</span><select name="expenseId"><option value="">Не связан</option>${data.expenses.map(x => `<option value="${e(x.id)}"${x.id === r.expenseId ? ' selected' : ''}>${e(cafeName(data, x.cafeId))} · ${e(date(x.date))} · ${e(categoryName(data, x.categoryId))} · ${e(money(x.amount))}</option>`).join('')}</select><span class="field__hint">При необходимости свяжите выплату с расходом той же кофейни.</span></label>` + commentInput(r.comment); break;
    case 'cost': title = r.id ? 'Изменить себестоимость' : 'Себестоимость за месяц'; body = cafe() + input('month', 'Месяц', r.month || todayInZone().slice(0, 7), 'type="month" required') + amountInput('amount', 'Себестоимость', r.amount) + `<label class="check-field field--full"><input type="checkbox" name="expensesConfirmed"${r.expensesConfirmed ? ' checked' : ''}><span>Все операционные расходы за месяц внесены и подтверждены</span></label>`; break;
    case 'organization': title = 'Название организации'; body = input('name', 'Название', r.name || data.organization.name, 'required maxlength="100"'); break;
    case 'password': title = 'Изменить пароль'; body = input('currentPassword', 'Текущий пароль', '', 'type="password" autocomplete="current-password" required') + input('newPassword', 'Новый пароль', '', 'type="password" autocomplete="new-password" required'); break;
    default: throw new Error(`Неизвестный тип формы: ${kind}`);
  }
  return { title, submitLabel: kind === 'password' ? 'Изменить пароль' : 'Сохранить', body: `<div class="form-grid">${body}</div>` };
}
