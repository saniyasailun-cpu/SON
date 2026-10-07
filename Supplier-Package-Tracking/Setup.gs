function setupSystem() {
  lockOperation('setup-system', () => {
    ensureDatabase();
    const properties = PropertiesService.getScriptProperties();
    if (!properties.getProperty('SETUP_ADMIN_EMAIL')) {
      properties.setProperty('SETUP_ADMIN_EMAIL', 'admin@example.com');
    }
    if (!properties.getProperty('APP_VERSION')) {
      properties.setProperty('APP_VERSION', '1.0.0');
    }
    const triggers = ScriptApp.getScriptTriggers();
    const hasOverdueTrigger = triggers.some((trigger) => trigger.getHandlerFunction() === 'checkOverduePackages');
    if (!hasOverdueTrigger) {
      ScriptApp.newTrigger('checkOverduePackages').timeBased().everyHours(1).create();
    }
    const currentSettings = getCompanySettings();
    if (!currentSettings.companyName || currentSettings.companyName.includes('ยังไม่ได้กำหนด')) {
      throw new Error('กรุณากำหนดข้อมูลบริษัทก่อนใช้งานจริง');
    }
    return createResponse(true, { initialized: true }, 'ตั้งค่าระบบสำเร็จ');
  });
}

function initializeDemoData() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('DEMO_SEED_READY')) return createResponse(true, null, 'ข้อมูลตัวอย่างพร้อมใช้งานแล้ว');
  const supplierId = randomSecureId('SUP-');
  const supplier = {
    supplier_id: supplierId,
    company_name: 'บริษัทตัวอย่าง จำกัด',
    contact_person: 'นางสาวสมศรี ทดสอบ',
    email: 'supplier@example.com',
    phone: '02-000-0000',
    address: 'กรุงเทพมหานคร',
    is_active: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  getSheet('Suppliers').appendRow(Object.values(supplier));
  getSheet('Supplier_Accounts').appendRow([randomSecureId('SACC-'), supplierId, 'supplier@example.com', 'true', new Date().toISOString(), new Date().toISOString()]);
  props.setProperty('DEMO_SEED_READY', 'true');
  return createResponse(true, supplier, 'เพิ่มข้อมูลตัวอย่างสำเร็จ');
}

function saveSettings(data, request) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์ตั้งค่าระบบ');
  const settings = [
    ['company_name', String(data.company_name || CONFIG.companyName), 'ชื่อบริษัท'],
    ['company_address', String(data.company_address || CONFIG.companyAddress), 'ที่อยู่จัดส่ง'],
    ['company_phone', String(data.company_phone || CONFIG.companyPhone), 'หมายเลขโทรศัพท์ติดต่อ'],
    ['procurement_email', String(data.procurement_email || CONFIG.procurementEmail), 'อีเมลฝ่ายจัดซื้อ'],
    ['timezone', String(data.timezone || CONFIG.timezone), 'เขตเวลา'],
    ['overdue_deadline_hours', String(safeNumber(data.overdue_deadline_hours, CONFIG.overdueDeadlineHours)), 'ระยะเวลาแจ้งเตือนพัสดุค้างรับ'],
    ['business_hours', String(data.business_hours || CONFIG.businessHours), 'เวลาทำการ'],
    ['working_days', String(data.working_days || CONFIG.workingDays), 'วันทำการ'],
    ['notification_enabled', String(data.notification_enabled !== false), 'เปิด/ปิดการแจ้งเตือน'],
    ['supplier_login_enabled', String(data.supplier_login_enabled !== false), 'เปิดใช้งานผู้ขาย'],
    ['company_login_enabled', String(data.company_login_enabled !== false), 'เปิดใช้งานพนักงานบริษัท']
  ];
  settings.forEach(([key, value, description]) => setSetting(key, value, description));
  return createResponse(true, getCompanySettings(), 'บันทึกการตั้งค่าระบบสำเร็จ');
}

function validateRequiredSettings() {
  const settings = getCompanySettings();
  return settings.companyName && !settings.companyName.includes('ยังไม่ได้กำหนด') && settings.companyPhone && !settings.companyPhone.includes('000-000-0000');
}

function getSystemStatus() {
  return {
    initialized: !!PropertiesService.getScriptProperties().getProperty('SYSTEM_INITIALIZED'),
    settingsValid: validateRequiredSettings(),
    sheets: allSheetsReady(),
    version: PropertiesService.getScriptProperties().getProperty('APP_VERSION') || '1.0.0'
  };
}
