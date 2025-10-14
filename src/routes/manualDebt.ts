import { Router } from "express";
import adminAuth from "../middlewares/adminAuth";
import {
  postCreateManualDebt,
  getOpenManualDebt,
  postUpdateManualDebt,
  postBulkCreateManualDebt,  
} from "../controllers/manualDebt.controller";

const router = Router();

// ทั้งหมดให้ผ่าน adminAuth เสมอ
router.post("/admin/manual-debt/create",  adminAuth, postCreateManualDebt);
router.get ("/admin/manual-debt/list",    adminAuth, getOpenManualDebt);
router.post("/admin/manual-debt/update",  adminAuth, postUpdateManualDebt);
router.post("/admin/manual-debt/bulk-create", adminAuth, postBulkCreateManualDebt); 

export default router;
