export function escape(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

const paths = {
  bloom: '<path d="M12 12C3 12 4 2 9 4c3 1 3 6 3 8Zm0 0c0-9 10-8 8-3-1 3-6 3-8 3Zm0 0c9 0 8 10 3 8-3-1-3-6-3-8Zm0 0c0 9-10 8-8 3 1-3 6-3 8-3Z"/>',
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  revenue: '<path d="m3 16 6-6 4 4 8-10M15 4h6v6M3 21h18"/>',
  expense: '<path d="M4 4h16v16l-4-2-4 2-4-2-4 2V4ZM8 8h8M8 12h6"/>',
  wallet: '<path d="M4 5h14v4H4a2 2 0 0 1 0-4Zm0 4h17v11H4a2 2 0 0 1-2-2V7"/><path d="M16 13h5v4h-5z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2"/>',
  compare: '<path d="M4 21V10h4v11M10 21V3h4v18M16 21V7h4v14"/>',
  cost: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  settings: '<path d="m10 3-.7 3-2.5 1.5L4 7l-2 4 2 2.2v3L6 19l3-.5 3 2.5 3-2.5 3 .5 2-2.8v-3l2-2.2-2-4-2.8.5L14.7 6 14 3h-4Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  'arrow-up': '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14m-6-6 6 6 6-6"/>',
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  logout: '<path d="M10 4H4v16h6m4-4 4-4-4-4m-6 4h13"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  store: '<path d="M3 10h18L18 3H6l-3 7Zm1 0v11h16V10M9 21v-7h6v7M3 10c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="m7 3 3 5-3 2a15 15 0 0 0 7 7l2-3 5 3v3a2 2 0 0 1-2 2A19 19 0 0 1 2 5a2 2 0 0 1 2-2h3Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  building: '<path d="M4 21V3h12v18M16 9h4v12M8 7h4m-4 4h4m-4 4h4m-3 6v-2h2v2"/>',
  refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  warning: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.1"/>',
  filter: '<path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z"/>'
};

export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.info}</svg>`;
}
