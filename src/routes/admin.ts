import { Router, Request, Response } from "express";
import "dotenv/config";
import adminAuth from "../middlewares/adminAuth";
// (เดิมมี pool แต่ย้ายคิวรีไป service แล้ว จึงไม่ต้อง import pool ที่นี่)
// import { pool } from "../services/db";

import * as adminController from "../controllers/admin.controller";

const router = Router();

/* =========================
   Auth: Admin Login/Logout
   ========================= */

/** GET /admin/login — ฟอร์มล็อกอินแอดมิน */
router.get("/login", adminController.showLogin);

/** POST /admin/login — ตรวจ .env แล้วเซ็ต session.isAdmin */
router.post("/login", adminController.submitLogin);

/** GET /admin/dashboard — หน้าแดชบอร์ด (ต้องเป็นแอดมิน) */
router.get("/dashboard", adminAuth, adminController.showDashboard);

/** POST /admin/logout — ออกจากระบบแอดมิน */
router.post("/logout", adminController.logout);

/* ==========================================================
   Chat Realtime (สำหรับแอดมิน): ดูรายการ/ลบทีละรายการ/ล้างทั้งหมด
   ใช้ soft delete (IsDeleted = 1) และ broadcast ไปจอใหญ่
   ========================================================== */

/** (สะดวก) /admin/chat → เด้งไปแดชบอร์ดโซนแชท */
router.get("/chat", adminAuth, adminController.redirectChat);

/** GET /admin/chat/data — ดึงรายการข้อความล่าสุด (ไม่รวมที่ลบแล้ว) */
router.get("/chat/data", adminAuth, adminController.getChatData);

/** POST /admin/chat/:id/delete — ลบข้อความเดี่ยว (soft delete) + emit ให้จอใหญ่ลบแถวนั้น */
router.post("/chat/:id/delete", adminAuth, adminController.deleteMessage);

/** POST /admin/chat/clear — ล้างทั้งหมด (soft delete) + emit ให้เคลียร์จอ */
router.post("/chat/clear", adminAuth, adminAuth, adminController.clearChat); // (คง adminAuth ซ้ำ ตามไฟล์เดิม)

export default router;