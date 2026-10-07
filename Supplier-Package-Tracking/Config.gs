const CONFIG = (() => {
  const defaults = {
    companyName: 'บริษัทตัวอย่าง (ยังไม่ได้กำหนด)',
    companyAddress: 'ที่อยู่บริษัท (ยังไม่ได้กำหนด)',
    companyPhone: '000-000-0000',
    procurementEmail: 'procurement@example.com',
    timezone: 'Asia/Bangkok',
    overdueDeadlineHours: 2,
    businessHours: '09:00-17:00',
    workingDays: 'Mon,Tue,Wed,Thu,Fri',
    notificationEnabled: true,
    supplierLoginEnabled: true,
    companyLoginEnabled: true,
    defaultSupplierStatus: 'ACTIVE',
    defaultEmployeeStatus: 'ACTIVE',
    appName: 'SSPRMS'
  };

  return Object.freeze(defaults);
})();

function getSetting(key, fallback) {
  const settings = getSheetData('Settings');
  const found = settings.find((row) => String(row.setting_key || '').toLowerCase() === String(key).toLowerCase());
  if (!found) return fallback;
  if (found.setting_value === undefined || found.setting_value === null) return fallback;
  return found.setting_value;
}

function getSettingsObject() {
  const settings = getSheetData('Settings');
  return settings.reduce((acc, row) => {
    acc[String(row.setting_key || '')] = row.setting_value;
    return acc;
  }, {});
}

function setSetting(key, value, description) {
  const sheet = getSheet('Settings');
  const values = sheet.getDataRange().getValues();
  const startRow = 2;
  const rowIndex = values.findIndex((row) => String(row[0] || '').toLowerCase() === String(key).toLowerCase());
  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 1, 1, 1, 4).setValues([[key, value, description || '', new Date().toISOString()]]);
    return;
  }
  sheet.appendRow([key, value, description || '', new Date().toISOString()]);
}

function getCompanySettings() {
  const values = getSettingsObject();
  return {
    companyName: values.company_name || CONFIG.companyName,
    companyAddress: values.company_address || CONFIG.companyAddress,
    companyPhone: values.company_phone || CONFIG.companyPhone,
    procurementEmail: values.procurement_email || CONFIG.procurementEmail,
    timezone: values.timezone || CONFIG.timezone,
    overdueDeadlineHours: Number(values.overdue_deadline_hours || CONFIG.overdueDeadlineHours),
    businessHours: values.business_hours || CONFIG.businessHours,
    workingDays: values.working_days || CONFIG.workingDays,
    notificationEnabled: String(values.notification_enabled || 'true') !== 'false',
    supplierLoginEnabled: String(values.supplier_login_enabled || 'true') !== 'false',
    companyLoginEnabled: String(values.company_login_enabled || 'true') !== 'false'
  };
}

function ensureRequiredSettings() {
  const defaults = [
    ['company_name', CONFIG.companyName, 'ชื่อบริษัท'],
    ['company_address', CONFIG.companyAddress, 'ที่อยู่จัดส่ง'],
    ['company_phone', CONFIG.companyPhone, 'หมายเลขโทรศัพท์ติดต่อ'],
    ['procurement_email', CONFIG.procurementEmail, 'อีเมลฝ่ายจัดซื้อ'],
    ['timezone', CONFIG.timezone, 'เขตเวลา'],
    ['overdue_deadline_hours', String(CONFIG.overdueDeadlineHours), 'ระยะเวลารอรับเกินกำหนด (ชั่วโมง)'],
    ['business_hours', CONFIG.businessHours, 'เวลาทำการ'],
    ['working_days', CONFIG.workingDays, 'วันทำการ'],
    ['notification_enabled', 'true', 'เปิด/ปิดการแจ้งเตือน'],
    ['supplier_login_enabled', 'true', 'เปิดใช้งานการเข้าสู่ระบบของผู้ขาย'],
    ['company_login_enabled', 'true', 'เปิดใช้งานการเข้าสู่ระบบของพนักงานบริษัท']
  ];

  defaults.forEach(([key, value, description]) => {
    if (!getSetting(key, null)) {
      setSetting(key, value, description);
    }
  });
}
