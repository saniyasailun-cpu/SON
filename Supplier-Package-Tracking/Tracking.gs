function getShipmentStatusLabel(status) {
  const labels = {
    DRAFT: 'ร่างรายการ',
    PENDING_SHIPMENT: 'รอจัดส่ง',
    SHIPPED: 'จัดส่งแล้ว',
    ARRIVED: 'ถึงบริษัทแล้ว',
    COLLECTED: 'รับพัสดุแล้ว',
    VERIFIED: 'ตรวจสอบเรียบร้อย',
    COMPLETED: 'เสร็จสิ้น',
    CANCELLED: 'ยกเลิก',
    DELIVERY_EXCEPTION: 'มีปัญหาการจัดส่ง',
    RETURNED: 'ส่งคืน'
  };
  return labels[status] || status;
}

function updateStatusWithValidation(shipmentId, packageId, newStatus, request, remarks) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เปลี่ยนสถานะ');
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return createResponse(false, null, 'ไม่พบรายการพัสดุ');
  if (packageId) {
    return updatePackageStatus(packageId, newStatus, request, remarks, auth.session.accountId);
  }
  return updateShipmentStatus(shipmentId, newStatus, request, remarks);
}

function getStatusBadge(status) {
  const map = {
    DRAFT: '#6b7280',
    PENDING_SHIPMENT: '#f59e0b',
    SHIPPED: '#2563eb',
    ARRIVED: '#f97316',
    COLLECTED: '#10b981',
    VERIFIED: '#0891b2',
    COMPLETED: '#166534',
    CANCELLED: '#dc2626',
    DELIVERY_EXCEPTION: '#a16207',
    RETURNED: '#7c3aed'
  };
  return map[status] || '#374151';
}

function calculateOverdueStatus(packageRecord) {
  const settings = getCompanySettings();
  if (!packageRecord.arrived_at) return { overdue: false, reason: 'ยังไม่ได้ถึงบริษัท' };
  const arrived = new Date(packageRecord.arrived_at);
  const deadlineMs = settings.overdueDeadlineHours * 60 * 60 * 1000;
  const elapsed = Date.now() - arrived.getTime();
  return {
    overdue: elapsed > deadlineMs,
    elapsedMs: elapsed,
    deadlineMs: deadlineMs,
    waitingHours: elapsed / 3600000
  };
}

function buildShipmentOverview(shipment) {
  const packages = getShipmentPackages(shipment.shipment_id);
  const statuses = packages.map((pkg) => pkg.package_status || 'PENDING_SHIPMENT');
  const summary = getPackageStatusSummary(shipment.shipment_id);
  return {
    shipment_id: shipment.shipment_id,
    supplier_id: shipment.supplier_id,
    po_number: shipment.po_number,
    courier_name: shipment.courier_name,
    tracking_number: shipment.tracking_number,
    shipment_status: shipment.shipment_status,
    package_count: packages.length,
    arrival_count: statuses.filter((status) => status === 'ARRIVED').length,
    collection_count: statuses.filter((status) => status === 'COLLECTED').length,
    completed_count: statuses.filter((status) => status === 'COMPLETED').length,
    overall_status: summary.status
  };
}
