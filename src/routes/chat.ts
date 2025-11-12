// src/routes/chat.ts
// [refactor-mapping-only] route บางที่สุด: mapping → controller
import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

// [new] เรียกใช้ controller ที่เราแยกออกไป
import * as chatController from "../controllers/chat.controller";

const chatRouter = Router();

// GET /chat — ต้องล็อกอินก่อน
// [was] inline handler → [now] chatController.renderChatPage 
chatRouter.get("/", requireAuth, chatController.renderChatPage);

// POST /chat — สร้างข้อความใหม่ + broadcast
// [was] inline handler → [now] chatController.createMessage 
chatRouter.post("/", requireAuth, chatController.createMessage);

export default chatRouter;
