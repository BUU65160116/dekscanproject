import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import WarpController from "../controllers/warp.controller";

const router = Router();

// หน้า UI ลูกค้า
router.get("/warp", requireAuth, WarpController.renderWarpPage);

// อ่านเครดิต (รองรับ ?recalc=1)
router.get("/warp/credits", requireAuth, WarpController.getCredits);

// ใช้ 1 สิทธิ์ + เข้าคิว
router.post("/warp/use", requireAuth, WarpController.useOne);

export default router;
