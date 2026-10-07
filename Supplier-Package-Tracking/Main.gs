function doGet(e) {
  return HtmlService.createHtmlOutput(getAppHtml())
    .setTitle('ระบบบริหารจัดการพัสดุและติดตามการจัดส่งจากผู้ขาย')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAppHtml() {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SSPRMS</title></head><body><div id="app"></div></body></html>`;
}

function getCurrentSession(request) {
  return getCurrentUser(request);
}

function getDashboardData(request) {
  const auth = requireRole(request, ['supplier', 'employee']);
  if (!auth.authorized) return createResponse(false, null, 'กรุณาเข้าสู่ระบบ');
  const shipments = getSheetData('Shipments');
  const packages = getSheetData('Packages');
  if (auth.session.role === 'supplier') {
    return createResponse(true, {
      supplier: getSupplierById(auth.session.accountId),
      shipments: shipments.filter((row) => String(row.supplier_id) === String(auth.session.accountId)),
      packages: packages.filter((row) => shipments.some((shipment) => String(shipment.supplier_id) === String(auth.session.accountId) && String(shipment.shipment_id) === String(row.shipment_id)))
    }, 'เรียกดูภาพรวมสำเร็จ');
  }
  return createResponse(true, {
    shipments,
    packages,
    settings: getCompanySettings()
  }, 'เรียกดูภาพรวมสำเร็จ');
}

function doPost(e) {
  try {
    const data = getRequestData(e);
    const action = data.action;
    const request = { sessionToken: data.sessionToken };
    switch (action) {
      case 'login-request': return loginWithEmail(data.email, data.type || 'supplier');
      case 'login-verify': return verifyLogin(data.email, data.code);
      case 'logout': return logoutSession(request);
      case 'supplier-list': return listSuppliers(request);
      case 'supplier-create': return upsertSupplier(data, request);
      case 'supplier-account-create': return addSupplierAccount(data.supplier_id, data.email, request);
      case 'shipment-create': return createShipment(data, request);
      case 'shipment-update': return updateShipment(data.shipment_id, data, request);
      case 'shipment-list': return listShipments(request, data.filters);
      case 'shipment-status': return updateStatusWithValidation(data.shipment_id, data.package_id, data.status, request, data.remarks);
      case 'shipment-history': return getShipmentHistory(data.shipment_id, request);
      case 'packages-create': return createPackagesForShipment(data.shipment_id, data.count, request);
      case 'package-arrive': return markPackageArrived(data.package_id, request, data.remarks);
      case 'package-collect': return markPackageCollected(data.package_id, request, data.remarks);
      case 'package-verify': return markPackageVerified(data.package_id, request, data.remarks);
      case 'package-complete': return markPackageCompleted(data.package_id, request, data.remarks);
      case 'report-data': return getReportData(request, data);
      case 'label-preview': return printLabel(data.package_id);
      case 'settings-save': return saveSettings(data, request);
      default: return createResponse(false, null, 'คำสั่งไม่ถูกต้อง');
    }
  } catch (error) {
    return createResponse(false, null, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

function testApp() {
  return { ok: true, message: 'Apps Script backend initialized', sheets: allSheetsReady() };
}
