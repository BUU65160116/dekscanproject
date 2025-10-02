// src/routes/odoo.ts
import { Router } from "express";
import adminAuth from "../middlewares/adminAuth";
import { odooLogin, getCompanyId } from "../services/odoo";

const router = Router();

/**
 * GET /admin/odoo/test
 * ใช้ทดสอบการเชื่อม Odoo:
 *  - login -> uid
 *  - อ่าน company_id จาก pos.config
 */
router.get("/odoo/test", adminAuth, async (req, res) => {
  try {
    const uid = await odooLogin();
    const companyId = await getCompanyId(uid);
    res.json({ ok: true, uid, companyId });
  } catch (err: any) {
    // ส่ง error กลับไปให้เห็นก่อน (ภายหลังค่อยทำ error mapper สวย ๆ)
    res.status(500).json({ ok: false, error: err?.message || "unknown error" });
  }
});

export default router;
