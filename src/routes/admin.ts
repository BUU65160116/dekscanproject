// src/routes/admin.ts
import { Router, Request, Response } from "express";
import "dotenv/config";
import adminAuth from "../middlewares/adminAuth";
import { pool } from "../services/db";



const router = Router();

/* =========================
   Auth: Admin Login/Logout
   ========================= */

/** GET /admin/login — ฟอร์มล็อกอินแอดมิน */
router.get("/login", (_req: Request, res: Response) => {
  return res.render("admin/login", { error: null });
});

/** POST /admin/login — ตรวจ .env แล้วเซ็ต session.isAdmin */
router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  const ADMIN_USER = process.env.ADMIN_USER ?? "";
  const ADMIN_PASS = process.env.ADMIN_PASS ?? "";

  const ok = (username ?? "").trim() === ADMIN_USER && (password ?? "") === ADMIN_PASS;
  if (!ok) {
    return res.status(401).render("admin/login", { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }

  req.session.isAdmin = true;
  return req.session.save(() => res.redirect("/admin/dashboard"));
});

/** GET /admin/dashboard — หน้าแดชบอร์ด (ต้องเป็นแอดมิน) */
router.get("/dashboard", adminAuth, (_req: Request, res: Response) => {
  return res.render("admin/dashboard", { title: "Dashboard" });
});

/** POST /admin/logout — ออกจากระบบแอดมิน */
router.post("/logout", (req: Request, res: Response) => {
  req.session.isAdmin = false;
  return req.session.destroy(() => res.redirect("/admin/login"));
});

/* ==========================================================
   Chat Realtime (สำหรับแอดมิน): ดูรายการ/ลบทีละรายการ/ล้างทั้งหมด
   ใช้ soft delete (IsDeleted = 1) และ broadcast ไปจอใหญ่
   ========================================================== */

/** (สะดวก) /admin/chat → เด้งไปแดชบอร์ดโซนแชท */
router.get("/chat", adminAuth, (_req: Request, res: Response) => {
  return res.redirect("/admin/dashboard#chat"); // เปลี่ยน anchor ตามที่ใช้จริงในหน้า
});

/** GET /admin/chat/data — ดึงรายการข้อความล่าสุด (ไม่รวมที่ลบแล้ว) */
router.get("/chat/data", adminAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT
         ChatID     AS chatId,
         CustomerID AS customerId,
         TableID    AS tableId,
         Message    AS message,
         CreatedAt  AS createdAt
       FROM chat_message
       WHERE IsDeleted = 0
       ORDER BY ChatID DESC
       LIMIT 100`
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("admin.chat.data error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /admin/chat/:id/delete — ลบข้อความเดี่ยว (soft delete) + emit ให้จอใหญ่ลบแถวนั้น */
router.post("/chat/:id/delete", adminAuth, async (req: Request, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

  try {
    await pool.query("UPDATE chat_message SET IsDeleted = 1 WHERE ChatID = ?", [id]);
    req.io?.emit("deleteMessage", { chatId: id }); // แจ้งจอใหญ่/แดชบอร์ดให้ลบทันที
    return res.json({ ok: true });
  } catch (err) {
    console.error("admin.chat.delete error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /admin/chat/clear — ล้างทั้งหมด (soft delete) + emit ให้เคลียร์จอ */
router.post("/chat/clear", adminAuth, adminAuth, async (req: Request, res) => {
  try {
    await pool.query("UPDATE chat_message SET IsDeleted = 1 WHERE IsDeleted = 0");
    req.io?.emit("clearChat", {}); // ให้จอใหญ่เคลียร์รายการทั้งหมด
    return res.json({ ok: true });
  } catch (err) {
    console.error("admin.chat.clear error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
