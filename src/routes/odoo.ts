import { Router } from "express";
import adminAuth from "../middlewares/adminAuth";

// [new] เรียก controller แทน inline handler
import * as odooController from "../controllers/odoo.controller";

const router = Router();

/**
 * GET /admin/odoo/test
 * (สมมติถูก mount ใต้ /admin ตามคอมเมนต์เดิม)
 * ใช้ทดสอบการเชื่อม Odoo: login -> uid และอ่าน company_id จาก pos.config
 */
router.get("/odoo/test", adminAuth, odooController.testOdoo);

export default router;
