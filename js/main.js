import * as store from './store.js';
import { parseMoney, formatMoney, formatDate, todayInZone, monthRange, buildReport } from './domain.js';
import { renderAuth, renderPage, renderForm } from './views.js';
import { escape, icon } from './ui.js';

const app = document.getElementById('app');
const recordDialog = document.getElementById('record-dialog');
const confirmDialog = document.getElementById('confirm-dialog');
const pages = {
  overview: ['Обзор', 'Финансовая картина без лишнего шума', 'overview'],
  revenue: ['Продажи', 'Каждый день вашей кофейни в цифрах', 'revenue'],
  expenses: ['Расходы', 'Знайте, на что работает ваша выручка', 'expense'],
  money: ['Движение денег', 'Фактические поступления и выплаты', 'wallet'],
  costs: ['Себестоимость', 'Использованное сырьё, а не закупки', 'cost'],
  history: ['История операций', 'Все записи в одном месте', 'history'],
  compare: ['Сравнение точек', 'Один период. Единые правила. Ясная картина.', 'compare'],
  settings: ['Настройки', 'Ваше пространство, кофейни и категории', 'settings']
};
const collections = { cafe: 'cafes', category: 'categories', revenue: 'revenues', expense: 'expenses', movement: 'movements', cost: 'costs' };
const today = todayInZone();
const initialRange = monthRange(today.slice(0, 7));
const filters = { ...initialRange, cafeIds: [], search: '', type: 'all', categoryId: '' };
let data = null;
let report = null;
let route = 'overview';
let authMode = 'login';
let revision = 0;
let returnFocus = null;
let confirmAction = null;
let toastTimer;

function toast(message, error = false) {
  const region = document.getElementById('toast-region');
  clearTimeout(toastTimer);
  region.innerHTML = `<div class="toast${error ? ' toast--error' : ''}" role="${error ? 'alert' : 'status'}">${icon(error ? 'warning' : 'check')}<span>${escape(message)}</span><button class="icon-button" type="button" data-action="dismiss-toast" aria-label="Закрыть уведомление">${icon('close', 16)}</button></div>`;
  toastTimer = setTimeout(() => { region.replaceChildren(); }, error ? 10000 : 5000);
}

function readLocation() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  route = Object.hasOwn(pages, path) ? path : 'overview';
  const params = new URLSearchParams(query);
  const from = params.get('from');
  const to = params.get('to');
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || '') && /^\d{4}-\d{2}-\d{2}$/.test(to || '') && from <= to) {
    filters.from = from;
    filters.to = to;
  }
  if (params.has('cafe')) filters.cafeIds = params.getAll('cafe');
}

function filterMarkup() {
  const selected = data.cafes.filter(cafe => filters.cafeIds.includes(cafe.id));
  const label = selected.length ? selected.length === 1 ? selected[0].name : `Точек выбрано: ${selected.length}` : 'Все кофейни';
  return `<form id="report-filters" class="filter-form" aria-label="Период и кофейни">
    <div class="date-range">${icon('calendar', 17)}<label class="sr-only" for="period-from">Начало периода</label><input id="period-from" name="from" type="date" required value="${escape(filters.from)}"><span aria-hidden="true">–</span><label class="sr-only" for="period-to">Конец периода</label><input id="period-to" name="to" type="date" required value="${escape(filters.to)}"></div>
    <details class="cafe-picker"><summary>${icon('store', 17)}<span>${escape(label)}</span>${icon('chevron', 16)}</summary><div class="cafe-picker__options"><p class="field__hint">Нет отметок – все кофейни</p>${data.cafes.length ? data.cafes.map(cafe => `<label class="check-field"><input type="checkbox" name="cafeIds" value="${escape(cafe.id)}"${filters.cafeIds.includes(cafe.id) ? ' checked' : ''}><span>${escape(cafe.name)}${cafe.archived ? ' · архив' : ''}</span></label>`).join('') : '<p class="text-muted">Сначала добавьте кофейню</p>'}</div></details>
    <button class="button button--secondary button--small" type="submit">Показать</button>
    <select name="preset" aria-label="Быстрый выбор периода"><option value="">Выбрать период</option><option value="current">Этот месяц</option><option value="previous">Прошлый месяц</option><option value="week">Последние 7 дней</option><option value="today">Сегодня</option></select>
  </form>`;
}

function shell() {
  const session = store.getSession();
  const [title, subtitle] = pages[route];
  const primaryKind = { revenue: 'revenue', expenses: 'expense', money: 'movement', costs: 'cost', settings: 'cafe' }[route] || 'revenue';
  const primaryLabel = { revenue: 'Добавить продажи', expense: 'Добавить расход', movement: 'Добавить движение', cost: 'Внести себестоимость', cafe: 'Добавить кофейню' }[primaryKind];
  const navigation = Object.entries(pages).map(([key, [label, , symbol]]) => `<a class="nav-link${route === key ? ' is-active' : ''}" href="#/${key}"${route === key ? ' aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${route === key ? '<span class="nav-link__active-dot"></span>' : ''}</a>`).join('');
  app.innerHTML = `<div class="app-shell"><button class="sidebar-backdrop" type="button" data-action="close-menu" aria-label="Закрыть навигацию" tabindex="-1"></button>
    <aside class="sidebar" aria-label="Рабочее пространство"><button class="icon-button sidebar__close" type="button" data-action="close-menu" aria-label="Закрыть навигацию">${icon('close')}</button><a class="brand" href="#/overview" aria-label="Bloom, обзор">${icon('bloom', 35)}<span>Bloom<span class="brand__caption">COFFEE & CLARITY</span></span></a>
      <div class="workspace-badge">${icon('building', 18)}<span>${escape(data.organization.name)}<small>${session.demo ? 'Пространство с примерами' : 'Личное пространство'}</small></span></div>
      <p class="sidebar__label">УПРАВЛЕНИЕ</p><nav id="main-navigation" class="sidebar__nav" aria-label="Основная навигация">${navigation}</nav>
      <div class="sidebar__bottom"><div class="sidebar-note">${icon('lock', 17)}<p>Ваши цифры.<br><span>На вашем устройстве.</span></p></div><div class="profile"><span class="profile__avatar">${escape((session.name || 'B').slice(0, 1).toUpperCase())}</span><span class="profile__name">${escape(session.name)}<small>${session.demo ? 'Знакомство с Bloom' : 'Владелец'}</small></span><button type="button" class="icon-button" data-action="logout" aria-label="Выйти">${icon('logout', 18)}</button></div></div>
    </aside>
    <div class="workspace"><header class="topbar"><div class="topbar__title"><button type="button" class="icon-button mobile-menu" data-action="menu" aria-expanded="false" aria-controls="main-navigation" aria-label="Открыть навигацию">${icon('menu')}</button><span class="topbar__breadcrumb">Рабочее пространство <span>/</span> <strong>${escape(title)}</strong></span></div><div class="topbar__actions"><span class="local-status"><i></i> Сохранение на устройстве</span><a class="icon-button" href="#/settings" aria-label="Настройки аккаунта">${icon('user', 18)}</a></div></header>
      ${session.demo ? `<div class="demo-banner">${icon('info', 17)}<span><strong>Пространство с примерами.</strong> Все цифры иллюстративные. Изменения сохраняются отдельно от ваших данных.</span><button type="button" data-action="leave-demo">Создать своё ${icon('arrow-right', 16)}</button></div>` : ''}
      <main id="main" class="main-content" tabindex="-1"><div class="page-heading"><div class="page-heading__copy"><p class="eyebrow">${route === 'overview' ? 'ВСЁ ПОД КОНТРОЛЕМ' : 'BLOOM / ' + escape(title).toLocaleUpperCase('ru')}</p><h1>${escape(title === 'Обзор' ? 'Большая картина. Ясные цифры.' : title)}</h1><p>${escape(subtitle)}</p></div><div class="page-heading__actions"><button class="button button--primary" type="button" data-action="create" data-kind="${primaryKind}">${icon('plus', 18)}${primaryLabel}</button></div></div>
      ${route !== 'settings' ? `<div class="report-toolbar">${filterMarkup()}<button class="button button--ghost button--small" data-action="export" data-export="${route === 'compare' ? 'comparison' : route === 'overview' ? 'summary' : 'operations'}" type="button">${icon('download', 17)}<span>Экспорт CSV</span></button></div>` : ''}
      <div id="page-content">${renderPage(route, { data, filters, report, session })}</div><footer class="app-footer"><span>© ${new Date().getFullYear()} Bloom. Все права защищены.</span><button type="button" data-action="privacy">О хранении данных ${icon('arrow-right', 13)}</button></footer></main>
    </div></div>`;
  const navigationParams = new URLSearchParams({ from: filters.from, to: filters.to });
  filters.cafeIds.forEach(id => navigationParams.append('cafe', id));
  app.querySelectorAll('a[href^="#/"]').forEach(link => {
    if (!link.getAttribute('href').includes('?')) link.setAttribute('href', `${link.getAttribute('href')}?${navigationParams}`);
  });
  document.title = `${title} · Bloom`;
}

async function render({ focus = false } = {}) {
  const token = ++revision;
  if (!store.getSession()) {
    app.innerHTML = renderAuth(authMode);
    document.title = `${authMode === 'register' ? 'Создать пространство' : 'Добро пожаловать'} · Bloom`;
    return;
  }
  readLocation();
  app.setAttribute('aria-busy', 'true');
  try {
    const nextData = await store.snapshot();
    if (token !== revision) return;
    data = nextData;
    filters.cafeIds = filters.cafeIds.filter(id => data.cafes.some(cafe => cafe.id === id));
    report = buildReport(data, filters);
    shell();
    if (focus) document.getElementById('main').focus({ preventScroll: true });
  } catch (error) {
    if (token !== revision) return;
    app.innerHTML = `<main id="main" class="status-view error-state">${icon('warning', 38)}<h1>Не удалось открыть данные</h1><p>${escape(error.message)}</p><button type="button" class="button button--primary" data-action="retry">${icon('refresh', 18)}Попробовать снова</button><button type="button" class="button button--ghost" data-action="logout">Вернуться ко входу</button></main>`;
  } finally {
    if (token === revision) app.removeAttribute('aria-busy');
  }
}

function closeMenu() {
  app.querySelector('.app-shell')?.classList.remove('is-menu-open');
  app.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
  app.querySelector('.workspace')?.removeAttribute('inert');
}

function dialogClose(dialog) {
  dialog.close();
  if (returnFocus?.isConnected) returnFocus.focus();
  else document.querySelector('.page-heading h1')?.focus();
}

function openRecord(kind, id = null) {
  if (!data) return;
  if (['revenue', 'expense', 'movement', 'cost'].includes(kind) && !data.cafes.some(cafe => !cafe.archived)) {
    toast('Добавьте активную кофейню, чтобы начать учёт.');
    kind = 'cafe';
    id = null;
  }
  const record = kind === 'organization' ? data.organization : id ? data[collections[kind]]?.find(row => row.id === id) : null;
  if (id && !record) throw new Error('Запись не найдена. Обновите страницу.');
  const spec = renderForm(kind, record, { data, filters, report, session: store.getSession() });
  returnFocus = document.activeElement;
  recordDialog.innerHTML = `<form id="record-form" data-kind="${escape(kind)}" data-id="${escape(record?.id || '')}" data-version="${escape(record?.version ?? '')}" novalidate><div class="modal__header"><div><p class="eyebrow">ВАШ УЧЁТ</p><h2 id="dialog-title">${escape(spec.title)}</h2></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="Закрыть">${icon('close')}</button></div><div class="modal__body">${spec.body}<p id="form-error" class="form-error" role="alert" hidden></p></div><div class="modal__footer"><span class="field__hint">${icon('lock', 14)} Сохранится на этом устройстве</span><div class="form-actions"><button class="button button--secondary" type="button" data-action="close-dialog">Отмена</button><button class="button button--primary" type="submit">${icon('check', 17)}${escape(spec.submitLabel)}</button></div></div></form>`;
  recordDialog.showModal();
}

function confirm(title, text, action, { dangerous = true, label = 'Удалить запись' } = {}) {
  returnFocus = document.activeElement;
  confirmAction = action;
  confirmDialog.innerHTML = `<div class="modal__header"><h2 id="confirm-title">${escape(title)}</h2><button type="button" class="icon-button" data-action="close-confirm" aria-label="Закрыть">${icon('close')}</button></div><div class="modal__body"><div class="confirm-icon">${icon(dangerous ? 'trash' : 'info', 28)}</div><p>${escape(text)}</p><p id="confirm-error" class="form-error" role="alert" hidden></p></div><div class="modal__footer"><button class="button button--secondary" type="button" data-action="close-confirm">Отмена</button><button class="button ${dangerous ? 'button--danger' : 'button--primary'}" type="button" data-action="confirm">${escape(label)}</button></div>`;
  confirmDialog.showModal();
  confirmDialog.querySelector('[data-action="close-confirm"]').focus();
}

function formError(form, error) {
  const alert = form.querySelector('#form-error, .auth-error');
  if (alert) { alert.textContent = error.message || 'Не удалось сохранить данные. Попробуйте снова.'; alert.hidden = false; }
  for (const [name, message] of Object.entries(error.fields || {})) {
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    let note = input.closest('.field')?.querySelector('.field__error');
    if (!note) { note = document.createElement('span'); note.className = 'field__error'; input.after(note); }
    note.id = `${input.id || name}-error`;
    input.setAttribute('aria-describedby', [...new Set([...(input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean), note.id])].join(' '));
    note.textContent = message;
  }
  form.querySelector('[aria-invalid="true"]')?.focus();
}

function humanMinor(value) {
  if (value == null) return '';
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@\t\r]/.test(text) || /^-(?!\d+(?:[.,]\d+)?$)/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function operations() {
  const selected = row => row.date >= filters.from && row.date <= filters.to && (!filters.cafeIds.length || filters.cafeIds.includes(row.cafeId));
  const cafeName = id => data.cafes.find(cafe => cafe.id === id)?.name || '';
  const category = id => data.categories.find(item => item.id === id)?.name || '';
  const rows = [
    ...data.revenues.map(row => ({ ...row, type: 'revenue', typeLabel: 'Выручка', total: (BigInt(row.cash) + BigInt(row.card) + BigInt(row.delivery)).toString(), category: '' })),
    ...data.expenses.map(row => ({ ...row, type: 'expense', typeLabel: 'Расход', total: row.amount, category: category(row.categoryId) })),
    ...data.movements.map(row => ({ ...row, type: 'movement', typeLabel: row.direction === 'in' ? 'Поступление' : 'Выплата', total: row.amount, category: '' }))
  ];
  return rows.filter(selected).filter(row => route !== 'history' || filters.type === 'all' || row.type === filters.type)
    .filter(row => route !== 'history' || !filters.categoryId || row.categoryId === filters.categoryId)
    .filter(row => route !== 'history' || !filters.search || `${row.date} ${row.comment || ''} ${row.category} ${cafeName(row.cafeId)} ${row.typeLabel}`.toLocaleLowerCase('ru').includes(filters.search.toLocaleLowerCase('ru')))
    .sort((a, b) => b.date.localeCompare(a.date)).map(row => ({ ...row, cafeName: cafeName(row.cafeId) }));
}

function exportCSV(kind) {
  let rows;
  if (kind === 'comparison') {
    rows = [['Кофейня', 'Выручка, RUB', 'Операционные расходы, RUB', 'Себестоимость, RUB', 'Операционный результат, RUB', 'Денежный поток, RUB', 'Средний чек, RUB', 'Расчёт полный']];
    report.byCafe.forEach(row => rows.push([row.name, humanMinor(row.revenue), humanMinor(row.operatingExpenses), humanMinor(row.costOfGoods), humanMinor(row.operatingResult), humanMinor(row.cashFlow), humanMinor(row.averageCheck), row.complete ? 'Да' : 'Нет']));
  } else if (kind === 'summary') {
    rows = [['Показатель', 'Сумма, RUB'], ['Начало периода', filters.from], ['Конец периода', filters.to], ['Выручка', humanMinor(report.revenue)], ['Операционные расходы', humanMinor(report.operatingExpenses)], ['Себестоимость', humanMinor(report.costOfGoods)], ['Валовой результат', humanMinor(report.grossResult)], ['Операционный результат', humanMinor(report.operatingResult)], ['Поступления', humanMinor(report.cashIn)], ['Выплаты', humanMinor(report.cashOut)], ['Денежный поток', humanMinor(report.cashFlow)], ['Средний чек', humanMinor(report.averageCheck)], ['Расчёт полный', report.complete ? 'Да' : 'Нет']];
  } else {
    let entries = operations();
    if (route === 'revenue') entries = entries.filter(row => row.type === 'revenue');
    if (route === 'expenses') entries = entries.filter(row => row.type === 'expense');
    if (route === 'money') entries = entries.filter(row => row.type === 'movement');
    if (route === 'costs') {
      rows = [['Месяц', 'Кофейня', 'Себестоимость, RUB', 'Расходы проверены']];
      data.costs.filter(row => `${row.month}-01` <= filters.to && monthRange(row.month).to >= filters.from && (!filters.cafeIds.length || filters.cafeIds.includes(row.cafeId))).forEach(row => rows.push([row.month, data.cafes.find(cafe => cafe.id === row.cafeId)?.name || '', humanMinor(row.amount), row.expensesConfirmed ? 'Да' : 'Нет']));
    } else {
      rows = [['Дата', 'Тип', 'Кофейня', 'Категория', 'Сумма, RUB', 'Наличные, RUB', 'Карты, RUB', 'Доставка, RUB', 'Чеки', 'Комментарий']];
      entries.forEach(row => rows.push([row.date, row.typeLabel, row.cafeName, row.category, humanMinor(row.total), humanMinor(row.cash), humanMinor(row.card), humanMinor(row.delivery), row.receipts ?? '', row.comment || '']));
    }
  }
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `bloom-${kind}-${filters.from}-${filters.to}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV подготовлен. Проверьте загрузки браузера.');
}

function updatePeriod(form) {
  const values = new FormData(form);
  const from = String(values.get('from'));
  const to = String(values.get('to'));
  if (from > to) throw new Error('Начало периода должно быть не позже его окончания.');
  filters.from = from;
  filters.to = to;
  filters.cafeIds = values.getAll('cafeIds');
  const params = new URLSearchParams({ from, to });
  filters.cafeIds.forEach(id => params.append('cafe', id));
  history.replaceState(null, '', `#/${route}?${params}`);
  render();
}

async function submitRecord(form) {
  if (!form.reportValidity()) return;
  const kind = form.dataset.kind;
  const values = Object.fromEntries(new FormData(form));
  for (const key of kind === 'revenue' ? ['cash', 'card', 'delivery'] : ['expense', 'movement', 'cost'].includes(kind) ? ['amount'] : []) {
    try { values[key] = parseMoney(values[key]); }
    catch (error) { error.fields = { [key]: error.message }; throw error; }
  }
  if (kind === 'revenue') values.receipts = values.receipts === '' ? null : Number(values.receipts);
  if (kind === 'cost') values.expensesConfirmed = form.elements.expensesConfirmed.checked;
  if (kind === 'movement') values.expenseId = values.expenseId || null;
  if (kind === 'password') {
    await store.changePassword(values.currentPassword, values.newPassword);
  } else {
    await store.save(kind, values, form.dataset.id || null, form.dataset.version === '' ? null : Number(form.dataset.version));
  }
  dialogClose(recordDialog);
  await render();
  toast(kind === 'password' ? 'Пароль изменён.' : 'Изменения сохранены. Всё на своих местах.');
}

async function handleAction(button) {
  const action = button.dataset.action;
  const kind = button.dataset.kind;
  const id = button.dataset.id;
  if (action === 'auth-mode') { authMode = button.dataset.mode; await render(); }
  else if (action === 'demo') {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      await store.enterDemo();
      const date = new Date(`${todayInZone()}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - 1, 1);
      Object.assign(filters, monthRange(date.toISOString().slice(0, 7)), { cafeIds: [], search: '', type: 'all', categoryId: '' });
      history.replaceState(null, '', `#/overview?${new URLSearchParams({ from: filters.from, to: filters.to })}`);
      await render();
    } finally { if (button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); } }
  } else if (action === 'logout' || action === 'leave-demo') {
    store.logout(); data = null; authMode = action === 'leave-demo' ? 'register' : 'login';
    Object.assign(filters, initialRange, { cafeIds: [], search: '', type: 'all', categoryId: '' });
    history.replaceState(null, '', '#/overview');
    await render();
  } else if (action === 'menu') {
    const open = app.querySelector('.app-shell').classList.toggle('is-menu-open');
    button.setAttribute('aria-expanded', String(open));
    app.querySelector('.workspace').toggleAttribute('inert', open);
    if (open) app.querySelector('.sidebar a').focus();
  } else if (action === 'close-menu') closeMenu();
  else if (action === 'create') openRecord(kind);
  else if (action === 'edit') openRecord(kind, id);
  else if (action === 'delete') {
    const row = data[collections[kind]]?.find(item => item.id === id);
    if (!row) throw new Error('Запись не найдена.');
    const description = kind === 'revenue' ? `Продажи за ${formatDate(row.date)}` : kind === 'cost' ? `Себестоимость за ${row.month}` : `${kind === 'expense' ? 'Расход' : 'Движение денег'} за ${formatDate(row.date)} на ${formatMoney(row.amount)}`;
    confirm('Удалить запись?', `${description}. Показатели будут пересчитаны. Изменение останется в журнале.`, async () => { await store.remove(kind, id, row.version); });
  } else if (action === 'archive') {
    const archived = button.dataset.archived === 'true';
    confirm(archived ? 'Перенести в архив?' : 'Вернуть из архива?', archived ? 'История и отчёты сохранятся. Объект больше нельзя будет выбрать для новых операций.' : 'Объект снова будет доступен для новых операций.', () => store.archive(kind, id, archived), { dangerous: false, label: archived ? 'В архив' : 'Восстановить' });
  } else if (action === 'close-dialog') dialogClose(recordDialog);
  else if (action === 'close-confirm') dialogClose(confirmDialog);
  else if (action === 'confirm') {
    button.disabled = true;
    try { await confirmAction(); dialogClose(confirmDialog); await render(); toast('Изменения сохранены.'); }
    catch (error) { const node = confirmDialog.querySelector('#confirm-error'); node.textContent = error.message; node.hidden = false; }
    finally { button.disabled = false; }
  } else if (action === 'export') exportCSV(button.dataset.export || 'operations');
  else if (action === 'reset-filters') { Object.assign(filters, initialRange, { cafeIds: [], search: '', type: 'all', categoryId: '' }); history.replaceState(null, '', `#/${route}`); await render(); }
  else if (action === 'privacy') {
    returnFocus = document.activeElement;
    recordDialog.innerHTML = `<div class="modal__header"><h2 id="dialog-title">Ваши данные в Bloom</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Закрыть">${icon('close')}</button></div><div class="modal__body"><p>Финансовые записи и аккаунты сохраняются в IndexedDB этого браузера. Данные не отправляются на сервер и не синхронизируются с другими устройствами.</p><p>Локальный вход разделяет рабочие пространства, но не защищает от человека с доступом к профилю браузера. Не используйте здесь пароль от других сервисов.</p><p>Очистка данных сайта или приватного окна может удалить записи. Регулярно выгружайте CSV. Для сохранения используйте один и тот же адрес сайта и профиль браузера.</p></div><div class="modal__footer"><button type="button" class="button button--primary" data-action="close-dialog">Понятно</button></div>`;
    recordDialog.showModal();
  } else if (action === 'dismiss-toast') document.getElementById('toast-region').replaceChildren();
  else if (action === 'retry') await boot();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) {
    event.preventDefault();
    handleAction(button).catch(error => toast(error.message || 'Не удалось выполнить действие.', true));
  }
  if (event.target.closest('.sidebar a')) closeMenu();
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['auth-form', 'record-form', 'report-filters', 'history-filters'].includes(form.id)) return;
  event.preventDefault();
  if (form.dataset.saving === 'true') return;
  form.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field__error').forEach(node => { node.textContent = ''; });
  const alert = form.querySelector('#form-error, .auth-error');
  if (alert) alert.hidden = true;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]');
  if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
  form.dataset.saving = 'true';
  try {
    if (form.id === 'auth-form') {
      const values = Object.fromEntries(new FormData(form));
      if (form.dataset.mode === 'register') await store.register(values);
      else await store.login(values);
      Object.assign(filters, initialRange, { cafeIds: [], search: '', type: 'all', categoryId: '' });
      history.replaceState(null, '', '#/overview');
      await render();
    } else if (form.id === 'record-form') await submitRecord(form);
    else if (form.id === 'report-filters') updatePeriod(form);
    else {
      Object.assign(filters, Object.fromEntries(new FormData(form)));
      await render();
    }
  } catch (error) {
    formError(form, error);
    if (!form.querySelector('#form-error, .auth-error')) toast(error.message, true);
  } finally {
    delete form.dataset.saving;
    if (submit?.isConnected) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
  }
});

document.addEventListener('change', event => {
  if (!event.target.matches('#report-filters select[name="preset"]') || !event.target.value) return;
  const value = event.target.value;
  const current = todayInZone(data?.cafes.find(cafe => filters.cafeIds.includes(cafe.id))?.timeZone);
  let range = { from: current, to: current };
  if (value === 'current') range = monthRange(current.slice(0, 7));
  if (value === 'previous') { const date = new Date(`${current}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1, 1); range = monthRange(date.toISOString().slice(0, 7)); }
  if (value === 'week') { const date = new Date(`${current}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 6); range.from = date.toISOString().slice(0, 10); }
  const form = event.target.form;
  form.elements.from.value = range.from;
  form.elements.to.value = range.to;
  updatePeriod(form);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && app.querySelector('.is-menu-open')) { closeMenu(); app.querySelector('[data-action="menu"]')?.focus(); }
  if (event.key === 'Tab' && app.querySelector('.is-menu-open')) {
    const controls = [...app.querySelectorAll('.sidebar a, .sidebar button')].filter(node => !node.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
for (const dialog of [recordDialog, confirmDialog]) {
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialogClose(dialog); } });
  dialog.addEventListener('cancel', () => { if (returnFocus?.isConnected) queueMicrotask(() => returnFocus.focus()); });
}
window.addEventListener('hashchange', () => { closeMenu(); render({ focus: true }); });
window.addEventListener('pageshow', event => { if (event.persisted) render(); });

async function boot() {
  try { await store.init(); await render(); }
  catch (error) { app.innerHTML = `<main id="main" class="status-view error-state">${icon('warning', 40)}<h1>Хранилище недоступно</h1><p>${escape(error.message)}</p><p>Разрешите хранение данных для сайта и откройте Bloom через HTTPS или localhost.</p><button class="button button--primary" type="button" data-action="retry">Попробовать снова</button></main>`; }
}
boot();
