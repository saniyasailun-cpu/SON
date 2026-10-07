function getReportData(request, filters) {
  const auth = requireRole(request, ['employee']);
  if (!auth.authorized) return createResponse(false, null, 'ไม่มีสิทธิ์เรียกดูรายงาน');
  const shipments = getSheetData('Shipments');
  const packages = getSheetData('Packages');
  const suppliers = getSheetData('Suppliers');
  const report = {
    daily: summarizeByPeriod(shipments, 'day'),
    weekly: summarizeByPeriod(shipments, 'week'),
    monthly: summarizeByPeriod(shipments, 'month'),
    supplier: summarizeBySupplier(shipments, suppliers),
    received: packages.filter((pkg) => pkg.package_status === 'COLLECTED' || pkg.package_status === 'VERIFIED' || pkg.package_status === 'COMPLETED'),
    overdue: packages.filter((pkg) => pkg.package_status === 'ARRIVED' && new Date(pkg.arrived_at).getTime() < Date.now() - getCompanySettings().overdueDeadlineHours * 60 * 60 * 1000),
    unregistered: getSheetData('Packages').filter((pkg) => !pkg.shipment_id)
  };
  return createResponse(true, report, 'เรียกดูรายงานสำเร็จ');
}

function summarizeByPeriod(shipments, period) {
  return shipments.reduce((acc, shipment) => {
    const date = new Date(shipment.created_at || shipment.shipping_date || new Date());
    const key = period === 'day' ? getPeriodKey(date, 'day') : period === 'week' ? getPeriodKey(date, 'week') : getPeriodKey(date, 'month');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getPeriodKey(date, period) {
  const value = new Date(date);
  if (period === 'day') return value.toISOString().slice(0, 10);
  if (period === 'week') return `W${Math.ceil((value.getUTCDate() + value.getUTCDay()) / 7)}`;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function summarizeBySupplier(shipments, suppliers) {
  return suppliers.map((supplier) => {
    const supplierShipments = shipments.filter((shipment) => String(shipment.supplier_id) === String(supplier.supplier_id));
    return {
      supplier_id: supplier.supplier_id,
      company_name: supplier.company_name,
      shipments: supplierShipments.length,
      completed: supplierShipments.filter((shipment) => shipment.shipment_status === 'COMPLETED').length
    };
  });
}

function exportCsvReport(type) {
  const report = getReportData({ sessionToken: '' }, {});
  if (!report.success) return null;
  const rows = type === 'suppliers' ? summarizeBySupplier(getSheetData('Shipments'), getSheetData('Suppliers')) : [];
  const data = rows.length ? rows.map((row) => [row.company_name, row.shipments, row.completed]) : [];
  const header = type === 'suppliers' ? ['ผู้ขาย', 'จำนวนรายการ', 'เสร็จสิ้น'] : ['รายการ'];
  return `data:text/csv;charset=utf-8,${encodeURIComponent([header, ...data].map((row) => row.map(encodeCsv).join(',')).join('\n'))}`;
}
