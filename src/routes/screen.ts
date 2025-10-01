import { Router } from "express";
import { pool } from "../services/db";

const screenRouter = Router();

screenRouter.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.render("screen", { title: "Big Screen • Chat & Warp" });
});

// ⬇ ดึงประวัติแชทล่าสุด 50 รายการ
screenRouter.get("/history", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         ChatID as chatId,
         TableID as tableId,
         Message as message,
         CreatedAt as createdAt
       FROM chat_message
       WHERE IsDeleted = 0
       ORDER BY ChatID DESC
       LIMIT 50`
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

export default screenRouter;
