// src/routes/public.ts
// [refactor-mapping-only] เหลือแค่แม็ปเส้นทาง → controller
import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth";

// [new] import controller ของ public แทน inline handler
import {
  showHome,
  showPointsPage,
  showWarpPage,
  logout,
} from "../controllers/public.controller";

const router = Router();

// Login/Register (คงเดิม)
router.get("/login", showLogin);
router.post("/login", submitLogin);
router.get("/register", showRegister);
router.post("/register", submitRegister);

// Home / Points / Warp / Logout (ย้ายไป controller)
router.get("/home", showHome);
router.get("/points", requireAuth, showPointsPage);
router.get("/warp", requireAuth, showWarpPage);
router.get("/logout", logout);

export default router;
