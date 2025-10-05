
import { Request, Response } from "express";
import * as screenService from "../services/screen.service";

/** GET /screen  (ถูก mount ด้วย app.use("/screen", screenRouter)) */
export function showScreen(_req: Request, res: Response) {
  // เดิม: set no-store และ render("screen", { title })
  res.setHeader("Cache-Control", "no-store");
  return res.render("screen", { title: "Big Screen • Chat & Warp" });
}

/** GET /screen/history — ดึงประวัติแชทล่าสุด 50 รายการ */
export async function getHistory(_req: Request, res: Response) {
  try {
    const rows = await screenService.fetchHistory(); // คง limit = 50 เหมือนเดิม
    return res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("screen.history error:", e);
    return res.status(500).json({ ok: false });
  }
}