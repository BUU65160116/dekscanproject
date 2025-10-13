// src/routes/public.ts
import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth";

// ⬇️ ใช้ controller ของ public เฉพาะที่เกี่ยวกับ home/warp/logout เท่านั้น
import { showHome, showWarpPage, logout } from "../controllers/public.controller";

// ⬇️ ใช้ router ของแต้ม (ภายในไฟล์ routes/points.ts จะ requireAuth เองทุกเส้นทาง)
import pointsRouter from "./points";

const router = Router();

// ===== Auth Pages (คงเดิม) =====
router.get("/login", showLogin);
router.post("/login", submitLogin);
router.get("/register", showRegister);
router.post("/register", submitRegister);

// ===== Public Pages (คงเดิม) =====
router.get("/home", showHome);
router.get("/warp", requireAuth, showWarpPage);
router.get("/logout", logout);

// ===== Points Feature =====
// แทนที่จะ import showPointsPage/redeemReward จาก public.controller (ผิดที่)
// ให้เมานต์ทั้งฟีเจอร์ไว้ใต้ /points ผ่าน pointsRouter
// -> GET /points
// -> POST /points/redeem
router.use("/points", pointsRouter);

export default router;
