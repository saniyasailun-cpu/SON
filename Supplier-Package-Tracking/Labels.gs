function generateLabelHtml(packageId) {
  const pkg = getPackageById(packageId);
  if (!pkg) throw new Error('ไม่พบรหัสพัสดุ');
  const shipment = getShipmentById(pkg.shipment_id);
  const supplier = getSupplierById(shipment.supplier_id);
  const settings = getCompanySettings();
  const qrText = `${packageId}|${shipment.shipment_id}`;
  const qr = createQrDataUri(qrText);
  return `<!doctype html><html><head><meta charset="utf-8"><title>ป้ายพัสดุ ${escapeHtml(packageId)}</title><style>@page{size:100mm 150mm;margin:8mm}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#000;background:#fff}.label{width:84mm;height:134mm;padding:6mm;box-sizing:border-box;border:2px solid #000}.header{font-size:18px;font-weight:700;margin-bottom:4mm}.kv{font-size:11px;line-height:1.45;margin:1mm 0}.title{font-size:19px;font-weight:800;text-align:center;margin:4mm 0;background:#000;color:#fff;padding:3mm}.phone{font-size:22px;font-weight:900;text-align:center;color:#000;margin:3mm 0}.qr{width:44mm;height:44mm;display:block;margin:3mm auto;border:2px solid #000;background:#fff}.small{font-size:9px}.strong{font-weight:800}.row{display:flex;justify-content:space-between;gap:4mm}.meta{font-size:10px}.warning{font-size:16px;font-weight:900;text-align:center;margin:3mm 0}</style></head><body><div class="label"><div class="header">${escapeHtml(settings.companyName)}</div><div class="row"><div class="meta">${escapeHtml(settings.companyAddress)}</div></div><div class="kv"><span class="strong">ฝ่ายรับพัสดุ:</span> ฝ่ายจัดซื้อ</div><div class="kv"><span class="strong">ผู้ขาย:</span> ${escapeHtml(supplier ? supplier.company_name : '')}</div><div class="kv"><span class="strong">ผู้ติดต่อ:</span> ${escapeHtml(supplier ? supplier.contact_person : '')}</div><div class="kv"><span class="strong">เลขที่ใบสั่งซื้อ:</span> ${escapeHtml(shipment.po_number || '-')}</div><div class="kv"><span class="strong">เลขที่รายการ:</span> ${escapeHtml(shipment.shipment_id)}</div><div class="kv"><span class="strong">รหัสพัสดุ:</span> ${escapeHtml(packageId)}</div><div class="kv"><span class="strong">พัสดุ:</span> ${escapeHtml(pkg.package_number)}/${escapeHtml(pkg.total_packages)}</div><div class="kv"><span class="strong">บริษัทขนส่ง:</span> ${escapeHtml(shipment.courier_name)}</div><div class="kv"><span class="strong">หมายเลขติดตาม:</span> ${escapeHtml(shipment.tracking_number || pkg.tracking_number)}</div><div class="title">กรุณาโทรแจ้งเมื่อพัสดุมาถึง</div><div class="phone">โทร. ${escapeHtml(settings.companyPhone)}</div><div class="warning">โปรดติดต่อเจ้าหน้าที่ก่อนส่งมอบพัสดุ</div><img class="qr" src="${qr}" alt="QR Code ${escapeHtml(packageId)}"><div class="meta">QR Code: ${escapeHtml(packageId)}</div></div></body></html>`;
}

function printLabel(packageId) {
  const html = generateLabelHtml(packageId);
  return createResponse(true, { html }, 'พร้อมพิมพ์ใบปะหน้าพัสดุ');
}

function createQrDataUri(value) {
  const QRCode = requireQRCode();
  return QRCode.generate(value);
}

function requireQRCode() {
  return {
    generate(value) {
      const encoded = encodeURIComponent(value);
      return 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encoded;
    }
  };
}
