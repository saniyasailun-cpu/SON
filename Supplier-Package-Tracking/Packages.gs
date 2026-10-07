function getPackageById(packageId) {
  return getRecordById('Packages', 'package_id', packageId);
}

function getShipmentPackages(shipmentId) {
  return getSheetData('Packages').filter((row) => String(row.shipment_id) === String(shipmentId));
}

function createPackagesForShipment(shipmentId, count, request) {
  const auth = requireRole(request, ['supplier']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์สร้างพัสดุ');
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  if (String(shipment.supplier_id) !== String(auth.session.accountId)) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  const packageCount = Math.max(1, safeNumber(count, 1));
  const created = [];
  for (let index = 1; index <= packageCount; index += 1) {
    const packageId = randomSecureId('PKG-');
    const packageRow = {
      package_id: packageId,
      shipment_id: shipmentId,
      package_number: index,
      total_packages: packageCount,
      tracking_number: sanitizeText(shipment.tracking_number) || '',
      package_status: 'PENDING_SHIPMENT',
      arrived_at: '',
      collected_at: '',
      verified_at: '',
      completed_at: '',
      collected_by: '',
      notes: ''
    };
    getSheet('Packages').appendRow(Object.values(packageRow));
    created.push(packageRow);
  }
  return createResponse(true, created, `สร้างพัสดุ ${packageCount} รายการสำเร็จ`);
}

function updatePackageStatus(packageId, newStatus, request, remarks, employeeId) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เปลี่ยนสถานะพัสดุ');
  const pkg = getPackageById(packageId);
  if (!pkg) return createResponse(false, null, 'ไม่พบพัสดุ');
  const previousStatus = pkg.package_status;
  const valid = {
    PENDING_SHIPMENT: ['ARRIVED', 'DELIVERY_EXCEPTION'],
    ARRIVED: ['COLLECTED', 'DELIVERY_EXCEPTION'],
    COLLECTED: ['VERIFIED'],
    VERIFIED: ['COMPLETED'],
    DELIVERY_EXCEPTION: ['CANCELLED', 'RETURNED'],
    CANCELLED: [],
    RETURNED: [],
    COMPLETED: []
  };
  if (!valid[previousStatus] || !valid[previousStatus].includes(newStatus)) return createResponse(false, null, `ไม่สามารถเปลี่ยนจาก ${previousStatus} เป็น ${newStatus}`);
  const rowIndex = getSheet('Packages').getDataRange().getValues().findIndex((row) => String(row[0]) === packageId);
  const now = new Date().toISOString();
  const values = getSheet('Packages').getRange(rowIndex + 1, 1, 1, 12).getValues()[0];
  const nextValues = {
    package_id: values[0],
    shipment_id: values[1],
    package_number: values[2],
    total_packages: values[3],
    tracking_number: values[4],
    package_status: newStatus,
    arrived_at: newStatus === 'ARRIVED' ? now : values[5],
    collected_at: newStatus === 'COLLECTED' ? now : values[6],
    verified_at: newStatus === 'VERIFIED' ? now : values[7],
    completed_at: newStatus === 'COMPLETED' ? now : values[8],
    collected_by: newStatus === 'COLLECTED' ? (employeeId || auth.session.accountId) : values[9],
    notes: values[10]
  };
  getSheet('Packages').getRange(rowIndex + 1, 1, 1, 12).setValues([[nextValues.package_id, nextValues.shipment_id, nextValues.package_number, nextValues.total_packages, nextValues.tracking_number, nextValues.package_status, nextValues.arrived_at, nextValues.collected_at, nextValues.verified_at, nextValues.completed_at, nextValues.collected_by, nextValues.notes]]);
  appendAuditLog(pkg.shipment_id, packageId, previousStatus, newStatus, auth.session.email, remarks || '');
  if (newStatus === 'ARRIVED') sendArrivalNotification(packageId);
  if (newStatus === 'COMPLETED') sendCompletionNotification(pkg.shipment_id);
  return createResponse(true, { package_id: packageId, package_status: newStatus }, 'อัปเดตสถานะพัสดุสำเร็จ');
}

function markPackageArrived(packageId, request, remarks) {
  return updatePackageStatus(packageId, 'ARRIVED', request, remarks, '');
}

function markPackageCollected(packageId, request, remarks) {
  return updatePackageStatus(packageId, 'COLLECTED', request, remarks, '');
}

function markPackageVerified(packageId, request, remarks) {
  return updatePackageStatus(packageId, 'VERIFIED', request, remarks, '');
}

function markPackageCompleted(packageId, request, remarks) {
  return updatePackageStatus(packageId, 'COMPLETED', request, remarks, '');
}

function getPackageStatusSummary(shipmentId) {
  const packages = getShipmentPackages(shipmentId);
  if (!packages.length) return { status: 'DRAFT' };
  const packageStatusOrder = ['PENDING_SHIPMENT', 'SHIPPED', 'ARRIVED', 'COLLECTED', 'VERIFIED', 'COMPLETED'];
  const statuses = packages.map((row) => row.package_status || 'PENDING_SHIPMENT');
  const highest = statuses.reduce((current, status) => {
    const oldIndex = packageStatusOrder.indexOf(current);
    const newIndex = packageStatusOrder.indexOf(status);
    return newIndex > oldIndex ? status : current;
  }, 'PENDING_SHIPMENT');
  return { status: highest, packages: packages.length, arrived: statuses.filter((v) => v === 'ARRIVED').length };
}

function resolveShipmentStatusFromPackages(shipmentId) {
  const shipment = getShipmentById(shipmentId);
  const summary = getPackageStatusSummary(shipmentId);
  if (!shipment) return null;
  if (summary.status === 'COMPLETED') return 'COMPLETED';
  if (summary.arrived > 0 && summary.packages > 0) return 'ARRIVED';
  return shipment.shipment_status;
}
