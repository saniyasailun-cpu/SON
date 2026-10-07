function sendShipmentStatusNotification(shipmentId, newStatus) {
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return false;
  const company = getCompanySettings();
  const supplier = getSupplierById(shipment.supplier_id);
  const subject = newStatus === 'SHIPPED' ? 'แจ้งยืนยันการจัดส่งพัสดุ' : 'แจ้งสถานะพัสดุเปลี่ยนแปลง';
  const html = `<div style="font-family:Arial,sans-serif;max-width:700px;color:#172033"><h2>${subject}</h2><p>เลขที่รายการ: <strong>${escapeHtml(shipment.shipment_id)}</strong></p><p>ผู้ขาย: ${escapeHtml(supplier ? supplier.company_name : '')}</p><p>บริษัทขนส่ง: ${escapeHtml(shipment.courier_name)}</p><p>หมายเลขติดตาม: ${escapeHtml(shipment.tracking_number)}</p><p>สถานะปัจจุบัน: ${escapeHtml(getShipmentStatusLabel(newStatus))}</p></div>`;
  try {
    GmailApp.sendEmail(company.procurementEmail, subject, '', { htmlBody: html });
    return true;
  } catch (error) {
    return false;
  }
}

function sendNotification(notificationType, recipient, shipmentId, packageId, details) {
  const idempotencyKey = `${notificationType}:${shipmentId || packageId || ''}:${recipient}:${Date.now()}`;
  const row = [randomSecureId('NTF-'), shipmentId || '', packageId || '', notificationType, recipient, new Date().toISOString(), 'PENDING', '', idempotencyKey];
  try {
    const subject = {
      NEW_SHIPMENT: 'แจ้งรายการพัสดุใหม่จากผู้ขาย',
      SHIPPED: 'แจ้งยืนยันการจัดส่งพัสดุ',
      ARRIVED: 'แจ้งพัสดุถึงบริษัทแล้ว',
      OVERDUE: 'แจ้งเตือนพัสดุรอรับเกินกำหนด',
      COMPLETED: 'ยืนยันการรับพัสดุเรียบร้อยแล้ว'
    }[notificationType] || 'แจ้งเตือนระบบ';
    const html = details.html || '';
    GmailApp.sendEmail(recipient, subject, '', { htmlBody: html });
    row[6] = 'SENT';
    getSheet('Notifications').appendRow(row);
    return true;
  } catch (error) {
    row[6] = 'FAILED';
    row[7] = String(error).slice(0, 500);
    getSheet('Notifications').appendRow(row);
    return false;
  }
}

function createNotificationRecord(notificationType, shipmentId, packageId, recipient, status, errorMessage, idempotencyKey) {
  getSheet('Notifications').appendRow([randomSecureId('NTF-'), shipmentId || '', packageId || '', notificationType, recipient, new Date().toISOString(), status, errorMessage || '', idempotencyKey]);
}

function sendNewShipmentNotification(shipmentId) {
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return false;
  const supplier = getSupplierById(shipment.supplier_id);
  const company = getCompanySettings();
  const html = `<div style="font-family:Arial,sans-serif;max-width:700px;color:#172033"><h2>แจ้งรายการพัสดุใหม่จากผู้ขาย</h2><p>ผู้ขาย: ${escapeHtml(supplier ? supplier.company_name : '')}</p><p>เลขที่รายการ: <strong>${escapeHtml(shipmentId)}</strong></p><p>เลขที่ใบสั่งซื้อ: ${escapeHtml(shipment.po_number)}</p><p>บริษัทขนส่ง: ${escapeHtml(shipment.courier_name)}</p><p>วันที่คาดว่าจะถึง: ${escapeHtml(formatDate(shipment.expected_arrival))}</p><p>จำนวนพัสดุ: ${escapeHtml(shipment.quantity || '1')}</p></div>`;
  return sendNotification('NEW_SHIPMENT', company.procurementEmail, shipmentId, '', { html });
}

function sendArrivalNotification(packageId) {
  const pkg = getPackageById(packageId);
  if (!pkg) return false;
  const shipment = getShipmentById(pkg.shipment_id);
  const company = getCompanySettings();
  const html = `<div style="font-family:Arial,sans-serif;max-width:700px;color:#172033"><h2>แจ้งพัสดุถึงบริษัทแล้ว</h2><p>รหัสพัสดุ: ${escapeHtml(packageId)}</p><p>เลขที่รายการ: ${escapeHtml(pkg.shipment_id)}</p><p>เวลา: ${escapeHtml(formatDateTime(pkg.arrived_at, true))}</p><p>ผู้ส่ง: ${escapeHtml(shipment ? shipment.courier_name : '')}</p></div>`;
  return sendNotification('ARRIVED', company.procurementEmail, pkg.shipment_id, packageId, { html });
}

function sendCompletionNotification(shipmentId) {
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return false;
  const supplier = getSupplierById(shipment.supplier_id);
  if (!supplier || !supplier.email) return false;
  const html = `<div style="font-family:Arial,sans-serif;max-width:700px;color:#172033"><h2>ยืนยันการรับพัสดุเรียบร้อยแล้ว</h2><p>เลขที่รายการ: <strong>${escapeHtml(shipment.shipment_id)}</strong></p><p>ผู้ขาย: ${escapeHtml(supplier.company_name)}</p><p>เลขที่ใบสั่งซื้อ: ${escapeHtml(shipment.po_number || '-')}</p><p>วันที่ยืนยัน: ${escapeHtml(formatDate(new Date().toISOString()))}</p><p>สถานะ: <strong>เสร็จสิ้น</strong></p></div>`;
  return sendNotification('COMPLETED', supplier.email, shipmentId, '', { html });
}

function sendOverdueNotification(packageId) {
  const pkg = getPackageById(packageId);
  if (!pkg) return false;
  const shipment = getShipmentById(pkg.shipment_id);
  const company = getCompanySettings();
  const html = `<div style="font-family:Arial,sans-serif;max-width:700px;color:#172033"><h2>แจ้งเตือนพัสดุรอรับเกินกำหนด</h2><p>รหัสพัสดุ: ${escapeHtml(packageId)}</p><p>ผู้ขาย: ${escapeHtml(shipment ? getSupplierById(shipment.supplier_id)?.company_name || '' : '')}</p><p>เวลาเข้ารับ: ${escapeHtml(formatDateTime(pkg.arrived_at, true))}</p><p>สถานะ: ${escapeHtml(getShipmentStatusLabel(pkg.package_status))}</p></div>`;
  return sendNotification('OVERDUE', company.procurementEmail, pkg.shipment_id, packageId, { html });
}

function checkOverduePackages() {
  const packages = getSheetData('Packages').filter((pkg) => pkg.package_status === 'ARRIVED');
  const company = getCompanySettings();
  const deadlineMs = company.overdueDeadlineHours * 60 * 60 * 1000;
  const notifications = getSheetData('Notifications');
  packages.forEach((pkg) => {
    const arrivedMs = new Date(pkg.arrived_at).getTime();
    if (Date.now() - arrivedMs <= deadlineMs) return;
    const sent = notifications.some((row) => String(row.package_id) === String(pkg.package_id) && row.notification_type === 'OVERDUE');
    if (!sent) sendOverdueNotification(pkg.package_id);
  });
  return packages.length;
}

function sendPackageStatusNotification(packageId, status) {
  if (status === 'ARRIVED') sendArrivalNotification(packageId);
  if (status === 'COMPLETED') {
    const pkg = getPackageById(packageId);
    const shipment = getShipmentById(pkg.shipment_id);
    sendCompletionNotification(shipment.shipment_id);
  }
}
