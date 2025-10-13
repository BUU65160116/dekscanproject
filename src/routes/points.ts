// src/routes/points.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { showPointsPage, redeemReward } from "../controllers/points.controller";

const router = Router();

router.get("/", requireAuth, showPointsPage);
router.post("/redeem", requireAuth, redeemReward);

export default router;
