function getShipmentById(shipmentId) {
  return getRecordById('Shipments', 'shipment_id', shipmentId);
}

function createShipment(data, request) {
  const auth = requireRole(request, ['supplier']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์ลงทะเบียนพัสดุ');
  const supplierId = auth.session.accountId;
  const shipmentId = randomSecureId('SHP-');
  const now = new Date().toISOString();
  const shipment = {
    shipment_id: shipmentId,
    supplier_id: supplierId,
    po_number: sanitizeText(data.po_number),
    invoice_number: sanitizeText(data.invoice_number),
    reference_number: sanitizeText(data.reference_number),
    package_category: sanitizeText(data.package_category),
    item_description: sanitizeText(data.item_description),
    quantity: safeNumber(data.quantity, 1),
    courier_name: sanitizeText(data.courier_name),
    tracking_number: sanitizeText(data.tracking_number),
    shipping_date: data.shipping_date || now,
    expected_arrival: data.expected_arrival || now,
    shipment_status: data.shipment_status || 'DRAFT',
    notes: sanitizeText(data.notes),
    created_at: now,
    updated_at: now
  };

  if (!shipment.item_description) return createResponse(false, null, 'กรุณาระบุรายละเอียดสินค้า');
  if (!shipment.courier_name) return createResponse(false, null, 'กรุณาระบุบริษัทขนส่ง');
  if (!shipment.shipment_status || !['DRAFT', 'PENDING_SHIPMENT', 'SHIPPED'].includes(shipment.shipment_status)) return createResponse(false, null, 'สถานะรายการไม่ถูกต้อง');

  const shipments = getSheet('Shipments');
  shipments.appendRow(Object.values(shipment));
  appendAuditLog(shipmentId, '', '', shipment.shipment_status, auth.session.email, 'ลงทะเบียนรายการพัสดุ');
  return createResponse(true, shipment, 'บันทึกรายการพัสดุสำเร็จ');
}

function updateShipment(shipmentId, data, request) {
  const auth = requireRole(request, ['supplier', 'employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์แก้ไขรายการ');
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  if (auth.session.role === 'supplier' && String(shipment.supplier_id) !== String(auth.session.accountId)) return createResponse(false, null, 'ไม่สามารถแก้ไขรายการของผู้ขายอื่น');
  const next = {
    shipment_id: shipmentId,
    supplier_id: shipment.supplier_id,
    po_number: sanitizeText(data.po_number) || shipment.po_number,
    invoice_number: sanitizeText(data.invoice_number) || shipment.invoice_number,
    reference_number: sanitizeText(data.reference_number) || shipment.reference_number,
    package_category: sanitizeText(data.package_category) || shipment.package_category,
    item_description: sanitizeText(data.item_description) || shipment.item_description,
    quantity: safeNumber(data.quantity, shipment.quantity),
    courier_name: sanitizeText(data.courier_name) || shipment.courier_name,
    tracking_number: sanitizeText(data.tracking_number) || shipment.tracking_number,
    shipping_date: data.shipping_date || shipment.shipping_date,
    expected_arrival: data.expected_arrival || shipment.expected_arrival,
    shipment_status: data.shipment_status || shipment.shipment_status,
    notes: sanitizeText(data.notes) || shipment.notes,
    created_at: shipment.created_at,
    updated_at: new Date().toISOString()
  };
  const rowIndex = getSheet('Shipments').getDataRange().getValues().findIndex((row) => String(row[0]) === shipmentId);
  if (rowIndex >= 0) {
    getSheet('Shipments').getRange(rowIndex + 1, 1, 1, 16).setValues([Object.values(next)]);
  }
  return createResponse(true, next, 'อัปเดตรายการพัสดุสำเร็จ');
}

function listShipments(request, filters) {
  const auth = requireRole(request, ['supplier', 'employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เรียกดูรายการ');
  let rows = getSheetData('Shipments');
  if (auth.session.role === 'supplier') rows = rows.filter((row) => String(row.supplier_id) === String(auth.session.accountId));
  if (filters && filters.status) rows = rows.filter((row) => String(row.shipment_status) === filters.status);
  if (filters && filters.search) {
    const term = String(filters.search).toLowerCase();
    rows = rows.filter((row) => [row.shipment_id, row.po_number, row.tracking_number, row.company_name, row.courier_name].join(' ').toLowerCase().includes(term));
  }
  return createResponse(true, rows, 'เรียกดูรายการสำเร็จ');
}

function updateShipmentStatus(shipmentId, newStatus, request, remarks) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เปลี่ยนสถานะ');
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  const valid = {
    DRAFT: ['PENDING_SHIPMENT'],
    PENDING_SHIPMENT: ['SHIPPED'],
    SHIPPED: ['ARRIVED'],
    ARRIVED: ['COLLECTED'],
    COLLECTED: ['VERIFIED'],
    VERIFIED: ['COMPLETED'],
    DELIVERY_EXCEPTION: ['CANCELLED', 'RETURNED'],
    CANCELLED: [],
    RETURNED: [],
    COMPLETED: []
  };
  const previousStatus = shipment.shipment_status;
  if (!valid[previousStatus] || !valid[previousStatus].includes(newStatus)) return createResponse(false, null, `ไม่สามารถเปลี่ยนจาก ${previousStatus} เป็น ${newStatus}`);
  const rowIndex = getSheet('Shipments').getDataRange().getValues().findIndex((row) => String(row[0]) === shipmentId);
  getSheet('Shipments').getRange(rowIndex + 1, 14, 1, 2).setValues([[newStatus, new Date().toISOString()]]);
  appendAuditLog(shipmentId, '', previousStatus, newStatus, auth.session.email, remarks || '');
  sendShipmentStatusNotification(shipmentId, newStatus);
  return createResponse(true, { shipment_status: newStatus }, 'อัปเดตสถานะสำเร็จ');
}

function getShipmentHistory(shipmentId, request) {
  const auth = requireRole(request, ['supplier', 'employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เรียกดูประวัติ');
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  if (auth.session.role === 'supplier' && String(shipment.supplier_id) !== String(auth.session.accountId)) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  const rows = getSheetData('Tracking_History').filter((row) => String(row.shipment_id) === shipmentId);
  return createResponse(true, rows, 'เรียกดูประวัติสำเร็จ');
}
