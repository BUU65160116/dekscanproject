// src/routes/unpaid.ts
import { Router } from "express";
import adminAuth from "../middlewares/adminAuth";
import { getUnpaidData, viewContact } from "../controllers/unpaid.controller";
import { prefillContact } from "../controllers/unpaid.controller";

const router = Router();

// คงพาธเดิมทุกอย่าง
router.get("/unpaid/data", adminAuth, getUnpaidData);

//   GET ให้เปิดหน้า contact 
router.get("/unpaid/contact/view", adminAuth, viewContact);

//  POST เดิมไว้ (จะใช้หรือไม่ใช้ก็ได้)
router.post("/unpaid/contact/view", adminAuth, viewContact);

// ใช้สำหรับ auto-fill ในหน้าข้อมูลติดต่อ
router.get("/unpaid/contact/prefill", adminAuth, prefillContact);

export default router;