import { Router } from "express";
import * as screenController from "../controllers/screen.controller";

const screenRouter = Router();

// เดิม: res.setHeader + render
screenRouter.get("/", screenController.showScreen);

// เดิม: ดึงประวัติ 50 รายการ
screenRouter.get("/history", screenController.getHistory);

export default screenRouter;