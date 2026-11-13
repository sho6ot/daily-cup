import { getModel } from './catalog.js';

const DB_NAME = 'relay-waitlist';
const STORE = 'applications';
const KEY = 'current';

export function validateApplication(input) {
  const data = {
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim(),
    company: String(input.company || '').trim(),
    useCase: String(input.useCase || '').trim(),
    model: String(input.model || ''),
    volume: String(input.volume || ''),
    details: String(input.details || '').trim(),
    consent: input.consent === true,
  };
  const errors = {};
  if (!data.name || data.name.length > 120) errors.name = 'Укажите имя, не более 120 символов.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) errors.email = 'Укажите корректный email.';
  if (data.company.length > 120) errors.company = 'Не более 120 символов.';
  if (!data.useCase || data.useCase.length > 200) errors.useCase = 'Опишите сценарий, не более 200 символов.';
  if (data.model && !getModel(data.model)) errors.model = 'Выберите модель из списка.';
  if (!['undecided', 'under-1m', '1m-10m', 'over-10m'].includes(data.volume)) errors.volume = 'Выберите предполагаемый объём.';
  if (data.details.length > 2000) errors.details = 'Не более 2000 символов.';
  if (!data.consent) errors.consent = 'Подтвердите согласие на сохранение на устройстве.';
  return { data, errors };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB недоступна в этом браузере.'));
      return;
    }
    let request;
    try { request = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
    let settled = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onblocked = () => { settled = true; reject(new Error('Хранилище заблокировано другой вкладкой. Закройте её и повторите попытку.')); };
    request.onerror = () => { settled = true; reject(request.error); };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function operation(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let result;
      let transaction;
      try {
        transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        request.onsuccess = () => { result = request.result; };
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('Ошибка хранилища.'));
      transaction.onabort = () => reject(transaction.error || new Error('Операция с хранилищем отменена.'));
    });
  } finally { db.close(); }
}

export function loadApplication() {
  return operation('readonly', store => store.get(KEY));
}

export async function saveApplication(input, previous) {
  const { data, errors } = validateApplication(input);
  if (Object.keys(errors).length) {
    const error = new Error('Проверьте поля заявки.');
    error.fields = errors;
    throw error;
  }
  const now = new Date().toISOString();
  const record = { id: previous?.id || crypto.randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now, ...data };
  await operation('readwrite', store => store.put(record, KEY));
  return record;
}

export function deleteApplication() {
  return operation('readwrite', store => store.delete(KEY));
}
