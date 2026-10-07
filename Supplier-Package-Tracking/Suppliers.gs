function getSupplierById(supplierId) {
  return getSheetData('Suppliers').find((row) => String(row.supplier_id) === String(supplierId));
}

function getSupplierAccessRecords(supplierId) {
  return getSheetData('Supplier_Accounts').filter((row) => String(row.supplier_id) === String(supplierId));
}

function upsertSupplier(data, request) {
  const authorization = requireRole(request, ['employee']);
  if (!authorization.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์จัดการผู้ขาย');
  const supplierId = data.supplier_id || randomSecureId('SUP-');
  if (!data.company_name) return createResponse(false, null, 'กรุณาระบุชื่อบริษัทผู้ขาย');
  const supplier = getSupplierById(supplierId);
  const now = new Date().toISOString();
  if (supplier) {
    const values = getSheet('Suppliers').getDataRange().getValues();
    const rowIndex = values.findIndex((row) => String(row[0]) === String(supplierId));
    if (rowIndex >= 0) {
      getSheet('Suppliers').getRange(rowIndex + 1, 1, 1, 9).setValues([[supplierId, data.company_name, data.contact_person || '', data.email || '', data.phone || '', data.address || '', data.is_active !== false ? 'ACTIVE' : 'INACTIVE', supplier.created_at || now, now]]);
    }
  } else {
    getSheet('Suppliers').appendRow([supplierId, data.company_name, data.contact_person || '', data.email || '', data.phone || '', data.address || '', data.is_active !== false ? 'ACTIVE' : 'INACTIVE', now, now]);
  }
  return createResponse(true, { supplier_id: supplierId }, 'บันทึกข้อมูลผู้ขายสำเร็จ');
}

function addSupplierAccount(supplierId, email, request) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เพิ่มบัญชีผู้ขาย');
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return createResponse(false, null, 'อีเมลไม่ถูกต้อง');
  const existing = getSheetData('Supplier_Accounts').find((row) => normalizeEmail(row.email) === normalized && String(row.supplier_id) === String(supplierId));
  if (existing) return createResponse(false, null, 'อีเมลนี้ถูกผูกกับผู้ขายรายนี้แล้ว');
  const accountId = randomSecureId('SACC-');
  getSheet('Supplier_Accounts').appendRow([accountId, supplierId, normalized, 'true', new Date().toISOString(), new Date().toISOString()]);
  return createResponse(true, { account_id: accountId }, 'เพิ่มบัญชีที่อนุมัติสำเร็จ');
}

function removeSupplierAccount(accountId, request) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์ยกเลิกบัญชี');
  const sheet = getSheet('Supplier_Accounts');
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex((row) => String(row[0]) === String(accountId));
  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 1, 4).setValue('false');
  }
  return createResponse(true, null, 'ยกเลิกบัญชีสำเร็จ');
}

function listSuppliers(request) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เรียกดูผู้ขาย');
  return createResponse(true, getSheetData('Suppliers'), 'เรียกดูผู้ขายสำเร็จ');
}

function supplierOwnsRecord(supplierId, shipmentId) {
  const shipment = getRecordById('Shipments', 'shipment_id', shipmentId);
  return shipment && String(shipment.supplier_id) === String(supplierId);
}
