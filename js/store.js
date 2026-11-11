import { demoData } from './demo.js';
import { todayInZone } from './domain.js';

const DB_NAME = 'bloom-ledger';
const SESSION_KEY = 'bloom-session';
const stores = ['users', 'organizations', 'cafes', 'categories', 'revenues', 'expenses', 'movements', 'costs', 'audit'];
const plural = { cafe: 'cafes', category: 'categories', revenue: 'revenues', expense: 'expenses', movement: 'movements', cost: 'costs', organization: 'organizations' };
let db;
let session = null;
const id = () => crypto.randomUUID();
const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const failure = error => new Error(`Не удалось сохранить или прочитать данные браузера: ${error?.message || 'ошибка хранилища'}`);
function transact(names, mode, action) {
  return new Promise((resolve, reject) => {
    let tx, result, problem;
    try {
      tx = db.transaction(names, mode);
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(problem || failure(tx.error));
      action(tx, value => { result = value; }, error => { problem = error; try { tx.abort(); } catch {} });
    } catch (error) { reject(failure(error)); }
  });
}
function all(tx, names, callback, fail) {
  const result = {};
  let remaining = names.length;
  for (const name of names) {
    const req = tx.objectStore(name).getAll();
    req.onsuccess = () => { result[name] = req.result; if (!--remaining) { try { callback(result); } catch (error) { fail(error); } } };
    req.onerror = () => fail(failure(req.error));
  }
}
function setSession(value) {
  try { if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); }
  catch (error) { throw failure(error); }
  session = value;
  return value;
}
export async function init() {
  if (db) return;
  try {
    db = await new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        for (const name of stores) {
          const store = open.result.createObjectStore(name, { keyPath: 'id' });
          if (name === 'users') store.createIndex('email', 'email', { unique: true });
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('Закройте другие вкладки Bloom и повторите попытку'));
    });
    db.onversionchange = () => { db.close(); db = null; };
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const value = JSON.parse(saved);
      const users = await transact(['users'], 'readonly', (tx, done, fail) => all(tx, ['users'], rows => done(rows.users), fail));
      const user = users.find(item => item.id === value.userId && item.organizationId === value.organizationId && !!item.demo === !!value.demo);
      if (user) session = { userId: user.id, organizationId: user.organizationId, name: user.name, email: user.email, demo: !!user.demo };
      else setSession(null);
    }
  } catch (error) { throw failure(error); }
}
export function getSession() { return session ? { ...session } : null; }
function requireSession() { if (!db || !session) throw new Error('Войдите в аккаунт'); return session; }
function text(value, field, max = 200) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) throw new Error(`Проверьте поле «${field}»`);
  return result;
}
function emailValue(value) { const email = text(value, 'Электронная почта', 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Введите корректную электронную почту'); return email; }
function passwordValue(value) { if (typeof value !== 'string' || value.length < 8 || value.length > 1024) throw new Error('Пароль должен содержать не менее 8 символов'); return value; }
const bytesToHex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
const hexToBytes = hex => Uint8Array.from(hex.match(/../g), value => parseInt(value, 16));
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return bytesToHex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: 210000 }, key, 256)));
}
const metadata = (organizationId, row) => ({ ...row, organizationId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 });
const defaults = [
  { name: 'Аренда', kind: 'operating', color: '#c77660' }, { name: 'Команда', kind: 'operating', color: '#d6ad75' },
  { name: 'Коммунальные услуги', kind: 'operating', color: '#829b83' }, { name: 'Продукты и зерно', kind: 'raw', color: '#b98c74' },
  { name: 'Оборудование', kind: 'capital', color: '#697f78' }
];
export async function register(values) {
  if (!db) throw new Error('Хранилище не открыто');
  const name = text(values.name, 'Имя'), organizationName = text(values.organizationName, 'Название организации'), email = emailValue(values.email), password = passwordValue(values.password);
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16))), hash = await hashPassword(password, salt);
  const organizationId = id(), userId = id();
  const user = { id: userId, organizationId, name, email, salt, hash, demo: false };
  await transact(['users', 'organizations', 'categories'], 'readwrite', (tx, done, fail) => {
    const lookup = tx.objectStore('users').index('email').get(email);
    lookup.onsuccess = () => {
      if (lookup.result) return fail(new Error('Аккаунт с такой почтой уже существует'));
      tx.objectStore('users').add(user);
      tx.objectStore('organizations').add(metadata(organizationId, { id: organizationId, name: organizationName, currency: 'RUB' }));
      for (const category of defaults) tx.objectStore('categories').add(metadata(organizationId, { ...category, id: id(), archived: false }));
      done();
    };
    lookup.onerror = () => fail(failure(lookup.error));
  });
  return setSession({ userId, organizationId, name, email, demo: false });
}
export async function login(values) {
  if (!db) throw new Error('Хранилище не открыто');
  const email = emailValue(values.email);
  const user = await transact(['users'], 'readonly', (tx, done, fail) => { const req = tx.objectStore('users').index('email').get(email); req.onsuccess = () => done(req.result); req.onerror = () => fail(failure(req.error)); });
  if (!user || user.demo || typeof values.password !== 'string' || await hashPassword(values.password, user.salt) !== user.hash) throw new Error('Неверная почта или пароль');
  return setSession({ userId: user.id, organizationId: user.organizationId, name: user.name, email: user.email, demo: false });
}
export function logout() { setSession(null); }
export async function enterDemo() {
  if (!db) throw new Error('Хранилище не открыто');
  const organizationId = 'bloom-demo-organization', userId = 'bloom-demo-user';
  await transact(stores, 'readwrite', (tx, done, fail) => {
    const lookup = tx.objectStore('users').get(userId);
    lookup.onsuccess = () => {
      if (!lookup.result) {
        const data = demoData();
        tx.objectStore('users').add({ id: userId, organizationId, name: 'Демо', email: 'demo@bloom.local', demo: true });
        tx.objectStore('organizations').add(metadata(organizationId, { id: organizationId, name: 'Bloom Coffee', currency: 'RUB' }));
        for (const [name, rows] of Object.entries(data)) for (const row of rows) tx.objectStore(name).add(metadata(organizationId, row));
      }
      done();
    };
    lookup.onerror = () => fail(failure(lookup.error));
  });
  return setSession({ userId, organizationId, name: 'Демо', email: 'demo@bloom.local', demo: true });
}
export async function snapshot() {
  const current = requireSession();
  const names = ['organizations', 'cafes', 'categories', 'revenues', 'expenses', 'movements', 'costs', 'audit'];
  return transact(names, 'readonly', (tx, done, fail) => all(tx, names, rows => {
    const organization = rows.organizations.find(row => row.id === current.organizationId);
    if (!organization) throw new Error('Организация не найдена');
    const result = { organization };
    for (const name of names.slice(1)) result[name] = rows[name].filter(row => row.organizationId === current.organizationId);
    done(result);
  }, fail));
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Введите корректную дату');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value.startsWith('0000')) throw new Error('Введите корректную дату');
  return value;
}
function month(value) { if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value.startsWith('0000')) throw new Error('Введите корректный месяц'); return value; }
function amount(value, positive = false) { if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Введите корректную сумму'); const n = BigInt(value); if (positive && n <= 0n) throw new Error('Сумма должна быть больше нуля'); return n.toString(); }
function choice(value, options, label) { if (!options.includes(value)) throw new Error(`Проверьте поле «${label}»`); return value; }
function comment(value) { if (value == null) return ''; if (typeof value !== 'string' || value.length > 2000) throw new Error('Комментарий слишком длинный'); return value.trim(); }
function audit(tx, organizationId, action, kind, row) {
  const now = new Date().toISOString();
  tx.objectStore('audit').add({ id: id(), organizationId, createdAt: now, updatedAt: now, version: 1, action, kind, recordId: row.id, record: row });
}
export async function save(kind, values, recordId = null, version = null) {
  const current = requireSession(), table = plural[kind];
  if (!table || !values || typeof values !== 'object') throw new Error('Неизвестный тип записи');
  const names = ['organizations', 'cafes', 'categories', 'revenues', 'expenses', 'movements', 'costs', 'audit'];
  return transact(names, 'readwrite', (tx, done, fail) => all(tx, names, rows => {
    const orgRows = name => rows[name].filter(row => row.organizationId === current.organizationId);
    const targetId = kind === 'organization' ? current.organizationId : recordId;
    if (kind === 'organization' && recordId && recordId !== current.organizationId) throw new Error('Запись не найдена');
    const old = targetId ? orgRows(table).find(row => row.id === targetId) : null;
    if (targetId && !old) throw new Error('Запись не найдена');
    if (old && version !== null && Number(version) !== old.version) throw new Error('Запись изменилась в другой вкладке. Обновите страницу');
    const newId = old?.id || id();
    const reference = (name, referenceId, label) => { const row = orgRows(name).find(item => item.id === referenceId); if (!row) throw new Error(`${label} не найдена`); return row; };
    let fields;
    if (kind === 'organization') fields = { name: text(values.name, 'Название организации'), currency: 'RUB' };
    else if (kind === 'cafe') {
      const timeZone = text(values.timeZone, 'Часовой пояс');
      try { new Intl.DateTimeFormat('ru-RU', { timeZone }).format(); } catch { throw new Error('Укажите корректный часовой пояс'); }
      const openedOn = date(values.openedOn);
      if (old) {
        const financial = ['revenues', 'expenses', 'movements', 'costs'].flatMap(name => orgRows(name).filter(row => row.cafeId === old.id));
        const historical = orgRows('audit').map(entry => entry.record).filter(row => row?.cafeId === old.id);
        const records = [...financial, ...historical];
        if (timeZone !== old.timeZone && records.length) throw new Error('Нельзя изменить часовой пояс кофейни с операциями');
        if (records.some(row => row.date ? row.date < openedOn : row.month && row.month < openedOn.slice(0, 7))) throw new Error('Дата открытия не может быть позже существующих операций');
      }
      const address = values.address == null || values.address === '' ? '' : text(values.address, 'Адрес', 250);
      fields = { name: text(values.name, 'Название'), address, timeZone, openedOn, archived: old?.archived || false, archivedOn: old?.archivedOn || null };
    } else if (kind === 'category') {
      const categoryKind = choice(values.kind, ['operating', 'raw', 'capital'], 'Тип');
      if (old && old.kind !== categoryKind && orgRows('expenses').some(row => row.categoryId === old.id)) throw new Error('Нельзя изменить тип категории с расходами');
      const color = text(values.color, 'Цвет');
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Укажите корректный цвет');
      fields = { name: text(values.name, 'Название'), kind: categoryKind, color, archived: old?.archived || false };
    } else {
      const cafe = reference('cafes', values.cafeId, 'Кофейня');
      if (cafe.archived && (!old || old.cafeId !== cafe.id)) throw new Error('Кофейня находится в архиве');
      if (kind === 'cost') {
        const period = month(values.month);
        if (period < cafe.openedOn.slice(0, 7)) throw new Error('Месяц раньше открытия кофейни');
        if (orgRows('costs').some(row => row.id !== newId && row.cafeId === cafe.id && row.month === period)) throw new Error('Себестоимость за этот месяц уже указана');
        fields = { cafeId: cafe.id, month: period, amount: amount(values.amount), expensesConfirmed: values.expensesConfirmed === true };
      } else {
        const day = date(values.date);
        if (day < cafe.openedOn) throw new Error('Дата раньше открытия кофейни');
        if (kind === 'revenue') {
          if (orgRows('revenues').some(row => row.id !== newId && row.cafeId === cafe.id && row.date === day)) throw new Error('Выручка за эту дату уже внесена');
          let receipts = values.receipts;
          if (receipts === '' || receipts === null || receipts === undefined) receipts = null;
          else { receipts = Number(receipts); if (!Number.isSafeInteger(receipts) || receipts < 0) throw new Error('Укажите целое число чеков'); }
          fields = { cafeId: cafe.id, date: day, cash: amount(values.cash), card: amount(values.card), delivery: amount(values.delivery), receipts, comment: comment(values.comment) };
        } else if (kind === 'expense') {
          const category = reference('categories', values.categoryId, 'Категория');
          if (category.archived && (!old || old.categoryId !== category.id)) throw new Error('Категория находится в архиве');
          if (old && old.cafeId !== cafe.id && orgRows('movements').some(row => row.expenseId === old.id)) throw new Error('Сначала удалите связанные платежи');
          fields = { cafeId: cafe.id, date: day, categoryId: category.id, amount: amount(values.amount, true), comment: comment(values.comment) };
        } else {
          const direction = choice(values.direction, ['in', 'out'], 'Направление');
          const expenseId = values.expenseId || null;
          if (expenseId) { const expense = reference('expenses', expenseId, 'Расход'); if (expense.cafeId !== cafe.id || direction !== 'out') throw new Error('Платёж должен относиться к расходу той же кофейни'); }
          fields = { cafeId: cafe.id, date: day, direction, source: choice(values.source, ['cash', 'card', 'delivery', 'other'], 'Источник'), amount: amount(values.amount, true), expenseId, comment: comment(values.comment) };
        }
      }
    }
    const now = new Date().toISOString();
    const row = { ...fields, id: newId, organizationId: current.organizationId, createdAt: old?.createdAt || now, updatedAt: now, version: old ? old.version + 1 : 1 };
    tx.objectStore(table).put(row);
    audit(tx, current.organizationId, old ? 'update' : 'create', kind, row);
    done(row);
  }, fail));
}
export async function remove(kind, recordId, version = null) {
  const current = requireSession(), table = plural[kind];
  if (!['revenue', 'expense', 'movement', 'cost'].includes(kind)) throw new Error('Эту запись нельзя удалить');
  return transact([table, 'movements', 'audit'], 'readwrite', (tx, done, fail) => all(tx, [...new Set([table, 'movements'])], rows => {
    const row = rows[table].find(item => item.id === recordId && item.organizationId === current.organizationId);
    if (!row) throw new Error('Запись не найдена');
    if (version !== null && Number(version) !== row.version) throw new Error('Запись изменилась в другой вкладке. Обновите страницу');
    if (kind === 'expense' && rows.movements.some(item => item.organizationId === current.organizationId && item.expenseId === row.id)) throw new Error('Сначала удалите связанные платежи');
    tx.objectStore(table).delete(row.id);
    audit(tx, current.organizationId, 'delete', kind, row);
    done();
  }, fail));
}
export async function archive(kind, recordId, archived) {
  const current = requireSession(), table = plural[kind];
  if (!['cafe', 'category'].includes(kind) || typeof archived !== 'boolean') throw new Error('Невозможно изменить архив');
  return transact([table, 'audit'], 'readwrite', (tx, done, fail) => all(tx, [table], rows => {
    const row = rows[table].find(item => item.id === recordId && item.organizationId === current.organizationId);
    if (!row) throw new Error('Запись не найдена');
    const updated = { ...row, archived, ...(kind === 'cafe' ? { archivedOn: archived ? todayInZone(row.timeZone) : null } : {}), updatedAt: new Date().toISOString(), version: row.version + 1 };
    tx.objectStore(table).put(updated); audit(tx, current.organizationId, archived ? 'archive' : 'restore', kind, updated); done(updated);
  }, fail));
}
export async function changePassword(currentPassword, newPassword) {
  const current = requireSession();
  if (current.demo) throw new Error('В демо-пространстве нельзя изменить пароль');
  passwordValue(newPassword);
  const user = await transact(['users'], 'readonly', (tx, done, fail) => { const req = tx.objectStore('users').get(current.userId); req.onsuccess = () => done(req.result); req.onerror = () => fail(failure(req.error)); });
  if (!user || typeof currentPassword !== 'string' || await hashPassword(currentPassword, user.salt) !== user.hash) throw new Error('Неверный текущий пароль');
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16))), hash = await hashPassword(newPassword, salt);
  await transact(['users'], 'readwrite', (tx, done, fail) => { const req = tx.objectStore('users').get(current.userId); req.onsuccess = () => { if (!req.result || req.result.hash !== user.hash) return fail(new Error('Пароль уже изменён. Повторите вход')); tx.objectStore('users').put({ ...req.result, salt, hash }); done(); }; req.onerror = () => fail(failure(req.error)); });
}
