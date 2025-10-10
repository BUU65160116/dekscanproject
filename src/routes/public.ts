import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth";

// [new] import controller ของ public แทน inline handler
import {
  showHome,
  showPointsPage,
  showWarpPage,
  logout,
  // === [POINTS FEATURE] เพิ่ม controller สำหรับแลกแต้ม ===
  redeemReward,
} from "../controllers/public.controller";

const router = Router();

// Login/Register (คงเดิม)
router.get("/login", showLogin);
router.post("/login", submitLogin);
router.get("/register", showRegister);
router.post("/register", submitRegister);

// Home / Points / Warp / Logout (คงเดิม)
router.get("/home", showHome);
router.get("/points", requireAuth, showPointsPage);
router.get("/warp", requireAuth, showWarpPage);
router.get("/logout", logout);

// === [POINTS FEATURE] เส้นทางแลกแต้ม (POST /redeem) ===
router.post("/redeem", requireAuth, redeemReward);

export default router;