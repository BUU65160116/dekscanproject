// src/controllers/unpaid.controller.ts
import { Request, Response } from "express";
import { getUnpaidList, getOrderInfoWithContact } from "../services/unpaid.service";

const ADMIN_PIN = process.env.ADMIN_CONTACT_PIN || "";

// ---------- GET /admin/unpaid/data (JSON) ----------
export async function getUnpaidData(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit) || 300;
    const { data, cached, count } = await getUnpaidList(limit);
    return res.json({ ok: true, data, meta: { cached, count } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
}

// ---------- POST /admin/unpaid/contact/view (render view) ----------
export async function viewContact(req: Request, res: Response) {
  try {
    const { orderId, pin } = req.body || {};
    if (!orderId) return res.status(400).send("missing orderId");
    if (!pin || pin !== ADMIN_PIN) return res.status(403).send("PIN ไม่ถูกต้อง");

    const { info, contact } = await getOrderInfoWithContact(Number(orderId));
    if (!info) return res.status(404).send("ไม่พบออเดอร์นี้");

    return res.render("admin/contact", {
      title: `ข้อมูลติดต่อ | โต๊ะ ${info.tableNo ?? "-"}`,
      order: info,
      contact, // { name, phone } | null
    });
  } catch (err: any) {
    return res.status(500).send(err?.message || "error");
  }
}
