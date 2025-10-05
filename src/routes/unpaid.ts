// src/routes/unpaid.ts
import { Router } from "express";
import adminAuth from "../middlewares/adminAuth";
import { getUnpaidData, viewContact } from "../controllers/unpaid.controller";

const router = Router();

// คงพาธเดิมทุกอย่าง
router.get("/unpaid/data", adminAuth, getUnpaidData);
router.post("/unpaid/contact/view", adminAuth, viewContact);

export default router;
