import { models, getModel } from './catalog.js';
import { escape } from './ui.js';
import { loadApplication, saveApplication, deleteApplication, validateApplication } from './applications.js';

const form = document.querySelector('#application-form');
const receipt = document.querySelector('#application-receipt');
const details = document.querySelector('#receipt-details');
const status = document.querySelector('#application-status');
const saveButton = document.querySelector('#save-application');
const cancelButton = document.querySelector('#cancel-edit');
const deleteDialog = document.querySelector('#delete-dialog');
const confirmDelete = document.querySelector('#confirm-delete');
const modelSelect = form.elements.model;
const volumes = { undecided: 'Пока не знаю', 'under-1m': 'До 1 млн', '1m-10m': '1–10 млн', 'over-10m': 'Более 10 млн' };
let current = null;
let busy = false;
let storageReady = false;
let loadFailed = false;

for (const model of models) {
  const option = document.createElement('option');
  option.value = model.id;
  option.textContent = `${model.name} (${model.creator})`;
  modelSelect.append(option);
}
const parameters = new URLSearchParams(location.search);
const requestedModel = parameters.get('model');
if (requestedModel && getModel(requestedModel)) modelSelect.value = requestedModel;
const requestedTokens = parameters.get('tokens');
if (requestedTokens && /^\d{1,16}$/.test(requestedTokens)) {
  const tokens = Number(requestedTokens);
  if (Number.isSafeInteger(tokens) && tokens > 0 && tokens <= 620000000000000) {
    form.elements.volume.value = tokens <= 1000000 ? 'under-1m' : tokens <= 10000000 ? '1m-10m' : 'over-10m';
  }
}

function message(text, isError = false) {
  status.textContent = text;
  status.classList.toggle('form-alert--error', isError);
  status.setAttribute('role', isError ? 'alert' : 'status');
}

function errorMessage(error) {
  if (error?.name === 'QuotaExceededError') return 'Недостаточно места в хранилище браузера. Освободите место и повторите попытку.';
  if (error?.message?.includes('заблокировано') || error?.message?.includes('недоступна')) return error.message;
  return 'Хранилище недоступно или операция не выполнена. Проверьте настройки браузера и повторите попытку.';
}

function setBusy(value) {
  busy = value;
  saveButton.disabled = value || !storageReady;
  cancelButton.disabled = value;
  confirmDelete.disabled = value;
  document.querySelector('#edit-application').disabled = value;
  document.querySelector('#download-application').disabled = value;
  document.querySelector('#delete-application').disabled = value;
  form.setAttribute('aria-busy', String(value));
  receipt.setAttribute('aria-busy', String(value));
}

function fillForm(record) {
  for (const name of ['name', 'email', 'company', 'useCase', 'model', 'volume', 'details']) {
    form.elements[name].value = record[name] || '';
  }
  form.elements.consent.checked = record.consent === true;
}

function showErrors(errors = {}) {
  for (const name of ['name', 'email', 'company', 'useCase', 'model', 'volume', 'details', 'consent']) {
    const field = form.elements[name];
    document.getElementById(`${name}-error`).textContent = errors[name] || '';
    if (errors[name]) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
}

function showReceipt(focus = false) {
  const model = current.model ? getModel(current.model) : null;
  const rows = [
    ['Номер заявки', current.id],
    ['Создана', new Date(current.createdAt).toLocaleString('ru-RU')],
    ['Обновлена', new Date(current.updatedAt).toLocaleString('ru-RU')],
    ['Имя', current.name], ['Email', current.email], ['Компания или проект', current.company || 'Не указаны'],
    ['Сценарий использования', current.useCase],
    ['Модель для пилота', model ? `${model.name} (${model.creator})` : current.model || 'Пока не определились'],
    ['Токенов в месяц', volumes[current.volume] || current.volume],
    ['Дополнительные детали', current.details || 'Не указаны'],
    ['Согласие на локальное сохранение', current.consent ? 'Да' : 'Нет'],
  ];
  details.innerHTML = rows.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
  form.hidden = true;
  receipt.hidden = false;
  if (focus) {
    const heading = document.querySelector('#receipt-title');
    heading.tabIndex = -1;
    heading.focus();
  }
}

async function initialize() {
  if (busy) return;
  setBusy(true);
  message('Проверяем сохранённую заявку…');
  try {
    current = await loadApplication() || null;
    storageReady = true;
    if (current) {
      if (loadFailed) {
        form.hidden = false;
        cancelButton.hidden = false;
        message('Найдена сохранённая заявка. Введённые данные остались в форме; сохраните их или отмените изменения.');
      } else {
        showReceipt();
        message('Заявка сохранена только в этом браузере и не отправлена.');
      }
    } else {
      form.hidden = false;
      receipt.hidden = true;
      message('Заполните форму, чтобы сохранить заявку на устройстве.');
    }
  } catch (error) {
    storageReady = false;
    loadFailed = true;
    form.hidden = false;
    message(`${errorMessage(error)} Заявка не загружена. `, true);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'text-link';
    retry.textContent = 'Повторить';
    retry.addEventListener('click', initialize);
    status.append(retry);
  } finally { setBusy(false); }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !storageReady) return;
  const input = Object.fromEntries(new FormData(form));
  input.consent = form.elements.consent.checked;
  const { errors } = validateApplication(input);
  showErrors(errors);
  if (Object.keys(errors).length) {
    message('Проверьте отмеченные поля.', true);
    form.elements[Object.keys(errors)[0]].focus();
    return;
  }
  setBusy(true);
  message('Сохраняем заявку на устройстве…');
  try {
    current = await saveApplication(input, current);
    showReceipt(true);
    message('Заявка сохранена только в этом браузере и не отправлена.');
  } catch (error) {
    if (error.fields) showErrors(error.fields);
    message(`${errorMessage(error)} Введённые данные сохранены в форме.`, true);
  } finally { setBusy(false); }
});

document.querySelector('#edit-application').addEventListener('click', () => {
  if (busy || !current) return;
  fillForm(current);
  showErrors();
  receipt.hidden = true;
  form.hidden = false;
  cancelButton.hidden = false;
  message('Измените данные и сохраните заявку повторно.');
  form.elements.name.focus();
});
cancelButton.addEventListener('click', () => {
  if (busy || !current) return;
  showErrors();
  showReceipt(true);
  message('Изменения отменены. Сохранённая заявка не изменилась.');
});

document.querySelector('#download-application').addEventListener('click', () => {
  if (busy || !current) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `relay-application-${current.id}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
deleteDialog.addEventListener('click', event => {
  if (event.target === deleteDialog && !busy) deleteDialog.close();
});
deleteDialog.addEventListener('close', () => {
  if (current && !busy) document.querySelector('#delete-application').focus();
});
document.querySelector('#delete-application').addEventListener('click', () => {
  if (!busy && current) deleteDialog.showModal();
});
confirmDelete.addEventListener('click', async () => {
  if (busy || !current) return;
  setBusy(true);
  message('Удаляем заявку с устройства…');
  try {
    await deleteApplication();
    current = null;
    deleteDialog.close();
    form.reset();
    showErrors();
    cancelButton.hidden = true;
    receipt.hidden = true;
    form.hidden = false;
    message('Заявка удалена из этого браузера.');
    form.elements.name.focus();
  } catch (error) {
    deleteDialog.close();
    message(`${errorMessage(error)} Заявка не удалена.`, true);
  } finally {
    setBusy(false);
    if (current) document.querySelector('#delete-application').focus();
  }
});

initialize();
