const DB = (() => {
  const SHEETS = {
    Suppliers: 'Suppliers',
    Employees: 'Employees',
    Shipments: 'Shipments',
    Packages: 'Packages',
    Tracking_History: 'Tracking_History',
    Notifications: 'Notifications',
    Settings: 'Settings',
    Supplier_Access: 'Supplier_Access',
    Supplier_Accounts: 'Supplier_Accounts',
    Security_Events: 'Security_Events'
  };

  return { SHEETS };
})();

function getSpreadsheets() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const spreadsheet = getSpreadsheets();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    throw new Error(`ไม่พบชีต ${name}`);
  }
  return sheet;
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  if (!values.length || values[0].length === 0) return [];
  const [header, ...rows] = values;
  return rows
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => {
      const object = {};
      header.forEach((key, index) => {
        object[String(key || '').trim()] = row[index];
      });
      return object;
    });
}

function ensureSheet(name, headers, options) {
  const spreadsheet = getSpreadsheets();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name, spreadsheet.getNumSheets());
    if (options && options.tabColor) {
      sheet.setTabColor(options.tabColor);
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
  const missing = headers.filter((header) => !existing.includes(header));
  if (missing.length) {
    const lastColumn = sheet.getLastColumn();
    const nextColumn = lastColumn + 1;
    sheet.getRange(1, nextColumn, 1, missing.length).setValues([missing]);
  }

  const firstDataRow = sheet.getLastRow() === 0 ? 1 : 2;
  if (sheet.getLastRow() === 1 && firstDataRow === 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function getNextId(prefix, sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < values.length; i += 1) {
    const value = values[i][0];
    if (!value || typeof value !== 'string') continue;
    const match = value.match(/(\d+)$/);
    if (match) {
      const number = Number(match[1]);
      if (number > max) max = number;
    }
  }
  return `${prefix}-${new Date().getFullYear()}-${String(max + 1).padStart(6, '0')}`;
}

function appendAuditLog(shipmentId, packageId, previousStatus, newStatus, changedBy, remarks) {
  const sheet = getSheet('Tracking_History');
  const eventId = randomSecureId('EVT-');
  sheet.appendRow([
    eventId,
    shipmentId || '',
    packageId || '',
    previousStatus || '',
    newStatus || '',
    changedBy || '',
    new Date().toISOString(),
    remarks || ''
  ]);
}

function logSecurityEvent(eventType, detail, userId, email) {
  const sheet = getSheet('Security_Events');
  sheet.appendRow([randomSecureId('SEC-'), eventType, detail, userId || '', email || '', new Date().toISOString()]);
}

function getRecordById(sheetName, idField, idValue) {
  const rows = getSheetData(sheetName);
  return rows.find((row) => String(row[idField] || '') === String(idValue));
}

function ensureDatabase() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const expectedSheets = [
    ['Suppliers', ['supplier_id', 'company_name', 'contact_person', 'email', 'phone', 'address', 'is_active', 'created_at', 'updated_at']],
    ['Employees', ['employee_id', 'full_name', 'email', 'department', 'is_active', 'created_at', 'updated_at']],
    ['Shipments', ['shipment_id', 'supplier_id', 'po_number', 'invoice_number', 'reference_number', 'package_category', 'item_description', 'quantity', 'courier_name', 'tracking_number', 'shipping_date', 'expected_arrival', 'shipment_status', 'notes', 'created_at', 'updated_at']],
    ['Packages', ['package_id', 'shipment_id', 'package_number', 'total_packages', 'tracking_number', 'package_status', 'arrived_at', 'collected_at', 'verified_at', 'completed_at', 'collected_by', 'notes']],
    ['Tracking_History', ['event_id', 'shipment_id', 'package_id', 'previous_status', 'new_status', 'changed_by', 'changed_at', 'remarks']],
    ['Notifications', ['notification_id', 'shipment_id', 'package_id', 'notification_type', 'recipient', 'sent_at', 'status', 'error_message', 'idempotency_key']],
    ['Settings', ['setting_key', 'setting_value', 'description', 'updated_at']],
    ['Supplier_Access', ['supplier_access_id', 'supplier_id', 'email', 'is_active', 'created_at', 'updated_at']],
    ['Supplier_Accounts', ['supplier_account_id', 'supplier_id', 'email', 'is_active', 'created_at', 'updated_at']],
    ['Security_Events', ['event_id', 'event_type', 'detail', 'user_id', 'email', 'created_at']]
  ];

  expectedSheets.forEach(([name, headers]) => ensureSheet(name, headers, { tabColor: '#1f4d7a' }));
  ensureRequiredSettings();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SYSTEM_INITIALIZED')) {
    props.setProperty('SYSTEM_INITIALIZED', 'true');
    props.setProperty('OTP_HASH_SALT', Utilities.getUuid());
    props.setProperty('NOTIFICATION_LAST_RUN', '');
  }

  setDefaultAdmin();
}

function setDefaultAdmin() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_EMAIL')) {
    props.setProperty('ADMIN_EMAIL', 'admin@example.com');
  }
}

function allSheetsReady() {
  return Object.values(DB.SHEETS).every((name) => getSpreadsheets().getSheetByName(name));
}
