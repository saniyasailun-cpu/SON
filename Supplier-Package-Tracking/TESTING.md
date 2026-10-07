# ข้อมูลการทดสอบระบบ

## สถานะการทดสอบในสภาพแวดล้อมนี้

การทดสอบที่ทำได้ใน workspace ปัจจุบันเป็นการตรวจสอบโครงสร้างไฟล์ การสะกดคำไทย การตรวจ syntax ของไฟล์ Apps Script และการยืนยันว่าคำสั่งสำคัญครบถ้วน

ไม่สามารถทดสอบสำเร็จจริงกับ Google Apps Script, Google Sheets, GmailApp, CacheService หรือ Script Triggers ได้ เพราะไม่มี Google Account และไม่มีสิทธิ์ OAuth จากผู้ใช้

## การทดสอบที่ควรทำหลัง Deploy

### Authentication

- Valid supplier login
- Invalid email
- Incorrect OTP
- Expired OTP
- Reused OTP
- Excessive login attempts
- Supplier access isolation
- Employee-only action rejection
- Logout and session expiration

### Shipment

- Create shipment
- Update shipment
- Mark shipped
- Create multiple packages
- Search and filter
- Prevent duplicate submission
- Validate tracking input

### Receiving

- Register arrival
- Confirm collection
- Confirm verification
- Complete receiving
- Partial shipment arrival
- Invalid status rejection

### Label

- Generate QR code
- Print label preview
- Check Thai label text
- Verify phone number and package numbering
- Reprint label

### Notifications

- New shipment notification
- Shipment update notification
- Arrival notification
- Completion notification
- Overdue reminder
- Avoid duplicate notifications
- Handle email failures

### UI

- Desktop layout
- Mobile responsive layout
- Sidebar navigation
- Forms and tables
- Search and pagination
- Modals and toast messages
- Loading and empty states
- Error messages

## ขั้นตอนการทดสอบด้วย Apps Script

```javascript
setupSystem();
initializeDemoData();
runLocalValidation();
checkOverduePackages();
```

จาก Apps Script ให้ตรวจสอบ:

1. `Suppliers` ถูกสร้าง
2. `Employees` ถูกสร้าง
3. `Shipments` และ `Packages` ถูกสร้าง
4. `Tracking_History` บันทึกการเปลี่ยนสถานะ
5. `Notifications` บันทึกผลการส่ง
6. `Settings` มีข้อมูลเริ่มต้น
7. Trigger สำหรับ `checkOverduePackages` ถูกสร้าง
8. เว็บแอพให้บริการแบบไม่ต้องใช้ login ของประเภทผู้ใช้นอกระบบ

## ประเมินผล

การทดสอบความสำเร็จที่จริงต้องใช้ Google Apps Script Runtime และตรวจสอบกับโค้ดที่ deploy จริง โดยควรเก็บ log ของการแจ้งเตือน และการยืนยันตัวตนอย่างครบถ้วน ทั้งนี้หากยังไม่มีการติดตั้งหรือตั้งค่าผ่าน Google Workspace ต้องไม่ถือว่าระบบพร้อมใช้งานใน Production
