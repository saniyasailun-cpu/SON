# การ Deploy และตั้งค่าโปรเจกต์

## ขั้นตอนการ Deploy

1. เปิด Google Apps Script โปรเจกต์
2. ตรวจสอบว่าไฟล์ทั้งหมดถูกอัปโหลดครบถ้วน
3. เปิดเมนู **Deploy → New deployment**
4. เลือกประเภท **Web app**
5. ตั้งค่าตามนี้:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. ยืนยันการอนุมัติสิทธิ์ที่ร้องขอ
7. คัดลอก URL ที่ได้จากการ Deploy แล้วนำไปใช้เป็น URL ของแอป
8. ตรวจสอบว่า Google App Script สามารถส่งอีเมลได้
9. เปิด Google Sheets ที่ระบบสร้างขึ้น และตรวจสอบ `Settings` เพื่อแก้ข้อมูลบริษัท

## การเปิดใช้งาน Trigger

จาก Apps Script ให้เปิด **Triggers** และเพิ่ม trigger สำหรับ:

- `checkOverduePackages`
- `every hour` หรือ `every 1 hour`

## การตั้งค่าเริ่มต้น

รัน function:

```javascript
setupSystem();
```

เมื่อต้องการข้อมูลตัวอย่าง:

```javascript
initializeDemoData();
```

## การตั้งค่าบัญชีผู้ขาย

1. เพิ่ม Supplier ในชีต `Suppliers`
2. เพิ่ม email ที่อนุมัติใน `Supplier_Accounts`
3. อีเมลนี้จะต้องเป็นอีเมลที่ลงทะเบียนกับ Google Workspace หรือผู้ให้บริการอีเมลที่สามารถรับ OTP ได้
4. ใช้ `login-request` และ `login-verify` ผ่านระบบผู้ขาย

## การตั้งค่าพนักงานบริษัท

1. เพิ่มพนักงานในชีต `Employees`
2. ให้ `is_active` เป็น `ACTIVE`
3. เพิ่มอีเมลที่ได้รับอนุมัติในสวิตช์การเข้าสู่ระบบ

## การตั้งค่าการแจ้งเตือน

- ปรับ `notification_enabled` ใน `Settings` เป็น `true`
- ตั้งค่า `procurement_email` เป็นอีเมลฝ่ายจัดซื้อ
- เพิ่ม `working_days` และ `overdue_deadline_hours`
- ตรวจสอบว่า GmailApp มีสิทธิ์และโควตาการส่งอีเมล

## ข้อควรระวัง

- ไม่ควรเปิดเผย Google Sheet โดยตรง
- ไม่ควรใช้ `Session.getActiveUser().getEmail()` เพื่อตรวจสอบผู้ใช้จากภายนอก
- หน้าต่างแสดงข้อมูลต้องยืนยัน Authentication และระบุสิทธิ์ทุกครั้งที่เรียก API
- ใช้เครื่องมือ Google Apps Script Deployment ตามผู้ดูแลระบบจริง

## การตั้งค่า URL ฝั่งผู้ใช้

เมื่อ deploy แล้วสามารถใช้ URL ที่ได้รับจาก Google Apps Script เป็น entry point ของแอป โดยหน้าเว็บจะพยายามประมวลผลด้วย `doGet` และ HTML Service
