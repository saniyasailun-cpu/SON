function toIsoString(date) {
  return new Date(date).toISOString();
}

function parseIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nowInBangkok() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
}

function formatDateTime(value, includeSeconds) {
  const date = parseIso(value) || new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false
  });
  return formatter.format(date);
}

function formatDate(value) {
  const date = parseIso(value) || new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function sanitizeText(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function randomSecureId(prefix) {
  const bytes = Utilities.getUuid().replace(/-/g, '');
  return (prefix || '').concat(bytes.substring(0, 12)).toUpperCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function createResponse(success, data, message, error) {
  return {
    success: Boolean(success),
    data: data || null,
    message: message || '',
    error: error || null
  };
}

function getRequestData(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function isTruthy(value) {
  return ['1', 'true', 'TRUE', 'yes', 'YES', 'Y'].includes(String(value));
}

function lockOperation(lockKey, callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function encodeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const needsQuotes = /[",\n\r]/.test(str);
  return needsQuotes ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function stripFormula(value) {
  return String(value || '').replace(/^\s*[=+\-@]/, '');
}

function preventFormulaInjection(value) {
  return stripFormula(sanitizeText(value));
}

function titleCase(value) {
  return String(value || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeUrl(path) {
  const scriptUrl = ScriptApp.getService().getUrl();
  return scriptUrl ? scriptUrl + path : path;
}
