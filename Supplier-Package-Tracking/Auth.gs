const AUTH = Object.freeze({
  SESSION_TTL_MS: 1000 * 60 * 60 * 8,
  OTP_TTL_MS: 1000 * 60 * 5,
  MAX_OTP_ATTEMPTS: 5,
  MAX_EMAIL_REQUESTS_PER_HOUR: 5
});

function getSessionStore() {
  return CacheService.getUserCache();
}

function getAuthContext() {
  const session = JSON.parse(Session.getActiveUser().getEmail() || 'null');
  return { email: '', role: 'anonymous' };
}

function normalizeRole(value) {
  return String(value || '').toLowerCase();
}

function createSession(accountId, role, email) {
  const user = { accountId, role, email, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + AUTH.SESSION_TTL_MS).toISOString() };
  const token = Utilities.getUuid();
  CacheService.getUserCache().put(token, JSON.stringify(user), AUTH.SESSION_TTL_MS / 1000);
  return token;
}

function getSessionFromRequest(request) {
  const rawToken = request && request.sessionToken ? request.sessionToken : '';
  if (!rawToken) return null;
  const token = String(rawToken).trim();
  const value = CacheService.getUserCache().get(token);
  if (!value) return null;
  const session = JSON.parse(value);
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    CacheService.getUserCache().remove(token);
    return null;
  }
  return session;
}

function requireRole(request, allowedRoles) {
  const session = getSessionFromRequest(request);
  if (!session) return { authorized: false, reason: 'SESSION_EXPIRED' };
  if (!allowedRoles.includes(session.role)) return { authorized: false, reason: 'FORBIDDEN' };
  return { authorized: true, session };
}

function generateOtp(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const salt = PropertiesService.getScriptProperties().getProperty('OTP_HASH_SALT') || Utilities.getUuid();
  const hashed = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${email}:${code}:${salt}`);
  const hash = Utilities.base64Encode(hashed)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const key = `otp:${normalizeEmail(email)}`;
  const attemptsKey = `otp_attempts:${normalizeEmail(email)}`;
  const existingAttempts = Number(CacheService.getUserCache().get(attemptsKey) || '0');
  if (existingAttempts >= AUTH.MAX_OTP_ATTEMPTS) {
    return { success: false, code: null, message: 'เกินจำนวนครั้งพยายาม กรุณาขอรหัสใหม่' };
  }
  CacheService.getUserCache().put(key, hash, AUTH.OTP_TTL_MS / 1000);
  CacheService.getUserCache().put(attemptsKey, String(existingAttempts + 1), 3600);
  return { success: true, code, hash };
}

function verifyOtp(email, code) {
  const key = `otp:${normalizeEmail(email)}`;
  const hash = CacheService.getUserCache().get(key);
  if (!hash) return false;
  const salt = PropertiesService.getScriptProperties().getProperty('OTP_HASH_SALT') || Utilities.getUuid();
  const expected = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${normalizeEmail(email)}:${code}:${salt}`))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  if (expected !== hash) {
    const attempts = Number(CacheService.getUserCache().get(`otp_verification:${normalizeEmail(email)}`) || '0') + 1;
    CacheService.getUserCache().put(`otp_verification:${normalizeEmail(email)}`, String(attempts), AUTH.OTP_TTL_MS / 1000);
    return false;
  }
  CacheService.getUserCache().remove(key);
  CacheService.getUserCache().remove(`otp_verification:${normalizeEmail(email)}`);
  return true;
}

function canRequestOtp(email) {
  const key = `otp_request:${normalizeEmail(email)}`;
  const last = Number(CacheService.getUserCache().get(key) || '0');
  const now = Date.now();
  if (last && now - last < 60000) return false;
  CacheService.getUserCache().put(key, String(now), 3600);
  return true;
}

function loginWithEmail(email, type) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) return createResponse(false, null, 'อีเมลไม่ถูกต้อง');
  const allowedTable = type === 'supplier' ? 'Supplier_Accounts' : 'Employees';
  const rows = getSheetData(allowedTable);
  const account = rows.find((row) => normalizeEmail(row.email) === normalizedEmail && String(row.is_active || '').toLowerCase() !== 'false');
  if (!account) return createResponse(false, null, 'ไม่พบบัญชีที่ยืนยันตัวตน');
  const otp = generateOtp(normalizedEmail);
  if (!otp.success) return createResponse(false, null, otp.message);
  const delivered = sendOtpEmail(normalizedEmail, otp.code, type);
  if (!delivered) return createResponse(false, null, 'ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่');
  CacheService.getUserCache().put(`login_type:${normalizedEmail}`, type, AUTH.OTP_TTL_MS / 1000);
  return createResponse(true, { email: normalizedEmail }, 'ส่งรหัสยืนยันแล้ว');
}

function verifyLogin(email, code) {
  const normalizedEmail = normalizeEmail(email);
  const type = CacheService.getUserCache().get(`login_type:${normalizedEmail}`) || 'supplier';
  if (!verifyOtp(normalizedEmail, code)) return createResponse(false, null, 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ');
  const account = findAuthorizedAccount(normalizedEmail, type);
  if (!account) return createResponse(false, null, 'บัญชีไม่ถูกอนุมัติ');
  const sessionToken = createSession(account.id, account.role, normalizedEmail);
  return createResponse(true, { sessionToken, user: { id: account.id, role: account.role, email: normalizedEmail } }, 'เข้าสู่ระบบสำเร็จ');
}

function findAuthorizedAccount(email, type) {
  if (type === 'supplier') {
    const access = getSheetData('Supplier_Accounts').find((row) => normalizeEmail(row.email) === normalizeEmail(email) && String(row.is_active || '').toLowerCase() !== 'false');
    if (!access) return null;
    const supplier = getSheetData('Suppliers').find((row) => String(row.supplier_id) === String(access.supplier_id));
    if (!supplier || String(supplier.is_active || '').toLowerCase() === 'false') return null;
    return { id: supplier.supplier_id, role: 'supplier', email: normalizeEmail(email) };
  }
  const employee = getSheetData('Employees').find((row) => normalizeEmail(row.email) === normalizeEmail(email) && String(row.is_active || '').toLowerCase() !== 'false');
  if (!employee) return null;
  return { id: employee.employee_id, role: 'employee', email: normalizeEmail(email) };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

function sendOtpEmail(email, code, type) {
  try {
    const company = getCompanySettings();
    const name = type === 'supplier' ? 'ผู้ขาย / ผู้ให้บริการ' : 'พนักงานบริษัท';
    GmailApp.sendEmail(email, `รหัสยืนยันสำหรับ${name} - ${company.companyName}`, '', {
      htmlBody: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>รหัสยืนยันสำหรับระบบจัดการพัสดุ</h2><p>รหัสยืนยันของคุณคือ <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>รหัสนี้ใช้ได้ภายใน 5 นาที และใช้ได้ครั้งเดียว</p></div>`,
      noReply: true
    });
    return true;
  } catch (error) {
    logSecurityEvent('EMAIL_ERROR', String(error), '', email);
    return false;
  }
}

function logoutSession(request) {
  const session = getSessionFromRequest(request);
  if (session) {
    CacheService.getUserCache().remove(request.sessionToken);
  }
  return createResponse(true, null, 'ออกจากระบบสำเร็จ');
}

function getCurrentUser(request) {
  const session = getSessionFromRequest(request);
  if (!session) return null;
  return { id: session.accountId, role: session.role, email: session.email };
}
