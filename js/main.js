import { escape, icon } from './ui.js';
import { models } from './catalog.js';
import { estimateUsage, formatTokens } from './usage.js';

function decorateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(node => {
    if (!node.querySelector('svg')) node.innerHTML = icon(node.dataset.icon, node.closest('.brand__mark') ? 28 : 20);
  });
}
decorateIcons();
document.addEventListener('relay:icons', () => decorateIcons());
document.querySelectorAll('[data-year]').forEach(node => { node.textContent = new Date().getFullYear(); });

const menu = document.querySelector('.site-nav');
const menuToggle = document.querySelector('.menu-toggle');
function closeMenu({ focus = false } = {}) {
  menu?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.setAttribute('aria-label', 'Открыть меню');
  if (focus) menuToggle?.focus();
}
menuToggle?.addEventListener('click', () => {
  const open = menu.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
  if (event.target.closest('.site-nav a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.classList.contains('is-open')) closeMenu({ focus: true });
});
matchMedia('(min-width: 721px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const backToTop = document.createElement('button');
backToTop.type = 'button';
backToTop.className = 'back-to-top';
backToTop.setAttribute('aria-label', 'Вернуться наверх');
backToTop.setAttribute('aria-hidden', 'true');
backToTop.innerHTML = icon('arrow-up', 22);
backToTop.tabIndex = -1;
backToTop.inert = true;
document.body.append(backToTop);
let topVisible = false;
function updateTopControl() {
  const visible = scrollY > 420;
  if (visible === topVisible) return;
  topVisible = visible;
  backToTop.classList.toggle('is-visible', visible);
  backToTop.setAttribute('aria-hidden', String(!visible));
  backToTop.tabIndex = visible ? 0 : -1;
  backToTop.inert = !visible;
  if (!visible && document.activeElement === backToTop) document.getElementById('main')?.focus({ preventScroll: true });
}
backToTop.addEventListener('click', () => {
  document.getElementById('main')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
window.addEventListener('scroll', updateTopControl, { passive: true });
window.addEventListener('pageshow', updateTopControl);
updateTopControl();

let toastTimer;
function toast(message, error = false) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  clearTimeout(toastTimer);
  region.innerHTML = `<div class="toast${error ? ' toast--error' : ''}" role="${error ? 'alert' : 'status'}">${icon(error ? 'warning' : 'check')}<span>${escape(message)}</span><button type="button" class="icon-button" aria-label="Закрыть уведомление" data-action="dismiss-toast">${icon('close', 16)}</button></div>`;
  toastTimer = setTimeout(() => region.replaceChildren(), error ? 9000 : 5000);
}

let privacyFocus;
document.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]');
  if (action?.dataset.action === 'privacy') {
    const dialog = document.getElementById('privacy-dialog');
    privacyFocus = document.activeElement;
    dialog.showModal();
  }
  if (action?.dataset.action === 'close-dialog') action.closest('dialog')?.close();
  if (action?.dataset.action === 'dismiss-toast') document.getElementById('toast-region')?.replaceChildren();
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    const target = document.getElementById(copy.dataset.copy);
    if (!target) return;
    try { await navigator.clipboard.writeText(target.textContent); toast('Пример запроса скопирован.'); }
    catch {
      const range = document.createRange(); range.selectNodeContents(target);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      toast('Копирование недоступно. Текст выделен: скопируйте его вручную.', true);
    }
  }
});
const privacyDialog = document.getElementById('privacy-dialog');
privacyDialog?.addEventListener('close', () => { if (privacyFocus?.isConnected) privacyFocus.focus(); });
privacyDialog?.addEventListener('click', event => {
  if (event.target !== privacyDialog) return;
  const bounds = privacyDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) privacyDialog.close();
});

const useCases = {
  chat: { label: 'ДИАЛОГИ', title: 'Помощник, который знает вашу задачу', description: 'Ответы на вопросы, объяснение возможностей продукта и работа с текстом. Начните с диалоговой модели и короткого понятного запроса.', prompt: 'Объясни новому пользователю, как создать первый проект. Ответь в трёх коротких шагах.', model: models.find(model => model.task === 'chat') },
  code: { label: 'КОД', title: 'От понятного вопроса к понятному коду', description: 'Разбор функций, объяснение ошибок и подготовка примеров. Модель помогает в работе, но результат по-прежнему требует проверки разработчиком.', prompt: 'Покажи пример debounce-функции на JavaScript и объясни, когда она полезна.', model: models.find(model => model.task === 'code') },
  reasoning: { label: 'РАССУЖДЕНИЯ', title: 'Разобрать задачу, прежде чем отвечать', description: 'Сравнение вариантов и последовательный разбор сложных вопросов. Важные выводы нужно проверять по фактам и требованиям вашего продукта.', prompt: 'Сравни очереди и синхронные HTTP-запросы для обработки изображений. Учитывай задержки и повторную обработку.', model: models.find(model => model.task === 'reasoning') }
};
function activateUseCase(key) {
  const scenario = useCases[key];
  if (!scenario || !document.getElementById('use-case-panel')) return;
  document.querySelectorAll('[data-use-case]').forEach(button => {
    const selected = button.dataset.useCase === key;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.getElementById('use-case-panel').setAttribute('aria-labelledby', `tab-${key}`);
  document.getElementById('use-case-label').textContent = scenario.label;
  document.getElementById('use-case-title').textContent = scenario.title;
  document.getElementById('use-case-description').textContent = scenario.description;
  document.getElementById('use-case-prompt').textContent = `«${scenario.prompt}»`;
  document.getElementById('use-case-link').href = `models.html?task=${encodeURIComponent(key)}`;
  const request = { model: scenario.model.id, messages: [{ role: 'user', content: scenario.prompt }] };
  const code = document.getElementById('request-code');
  code.innerHTML = JSON.stringify(request, null, 2).split('\n').map(line => escape(line).replace(/^(\s*)(&quot;[^&]*&quot;)(:)/, '$1<span class="code-key">$2</span>$3')).join('\n');
}
document.querySelectorAll('[data-use-case]').forEach(button => {
  button.addEventListener('click', () => activateUseCase(button.dataset.useCase));
  button.addEventListener('keydown', event => {
    const buttons = [...document.querySelectorAll('[data-use-case]')];
    let index = buttons.indexOf(button);
    if (event.key === 'ArrowRight') index = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') index = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = buttons.length - 1;
    else return;
    event.preventDefault();
    activateUseCase(buttons[index].dataset.useCase);
    buttons[index].focus();
  });
});
activateUseCase('chat');

const featured = document.getElementById('featured-models');
if (featured) {
  const chosen = ['chat', 'code', 'reasoning'].map(task => models.find(model => model.task === task));
  featured.innerHTML = chosen.map(model => `<article class="model-card"><div class="model-card__top"><span class="model-mark" aria-hidden="true">${escape(model.creator.slice(0, 1))}</span><span class="badge badge--muted">Для пилота</span></div><div class="model-card__identity"><div><h3 class="model-card__name">${escape(model.name)}</h3><p class="model-card__creator">${escape(model.creator)}</p></div></div><p class="model-card__description">${escape(model.description)}</p><div class="model-card__specs"><span>${formatTokens(model.contextTokens)} токенов контекста</span></div><div class="model-card__footer"><a class="text-link" href="waitlist.html?model=${encodeURIComponent(model.id)}">Выбрать для заявки ${icon('arrow-right', 17)}</a></div></article>`).join('');
}

const calculator = document.getElementById('token-calculator');
function updateCalculator(showErrors = false) {
  if (!calculator) return;
  const errorNode = document.getElementById('calculator-error');
  calculator.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
  try {
    const result = estimateUsage(Object.fromEntries(new FormData(calculator)));
    for (const key of ['total', 'input', 'output']) document.getElementById(`tokens-${key}`).textContent = formatTokens(result[key]);
    document.getElementById('tokens-requests').textContent = `${formatTokens(result.requests)} запросов за период`;
    document.getElementById('calculator-apply').href = `waitlist.html?tokens=${encodeURIComponent(result.total)}`;
    errorNode.hidden = true;
  } catch (error) {
    for (const key of ['total', 'input', 'output']) document.getElementById(`tokens-${key}`).textContent = '–';
    document.getElementById('tokens-requests').textContent = 'Заполните корректные параметры для расчёта.';
    document.getElementById('calculator-apply').href = 'waitlist.html';
    if (showErrors) {
      errorNode.hidden = false;
      errorNode.textContent = Object.values(error.fields || {}).join(' ') || error.message;
      for (const key of Object.keys(error.fields || {})) calculator.elements.namedItem(key)?.setAttribute('aria-invalid', 'true');
      calculator.querySelector('[aria-invalid="true"]')?.focus();
    }
  }
}
calculator?.addEventListener('input', () => updateCalculator(false));
calculator?.addEventListener('submit', event => { event.preventDefault(); updateCalculator(true); });
updateCalculator();
