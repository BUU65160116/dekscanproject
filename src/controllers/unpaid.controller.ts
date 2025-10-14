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

// ---------- POST/GET /admin/unpaid/contact/view ----------
export async function viewContact(req: Request, res: Response) {
  const { findContactsByTableToday } = require("../services/contact");
  try {
    //  รับ orderId ได้จากทั้ง query (GET) และ body (POST)
    const orderIdRaw = (req.query.orderId as string) ?? (req.body?.orderId as string);
    if (!orderIdRaw) return res.status(400).send("missing orderId");

    const { info } = await getOrderInfoWithContact(Number(orderIdRaw));
    if (!info) return res.status(404).send("ไม่พบออเดอร์นี้");
    if (info.tableNo == null) return res.status(400).send("missing tableNo");
    // ดึงรายชื่อผู้สแกนวันนี้ทั้งหมดของโต๊ะนั้น
    const contacts = await findContactsByTableToday(Number(info.tableNo));
    return res.render("admin/contact", {
      title: `ข้อมูลติดต่อ | โต๊ะ ${info.tableNo ?? "-"}`,
      order: info,
      contacts,
    });
  } catch (err: any) {
    return res.status(500).send(err?.message || "error");
  }
}


// ---------- GET /admin/unpaid/contact/prefill ----------
export async function prefillContact(req: Request, res: Response) {
  try {
    const orderId = Number(req.query.orderId);
    if (!orderId) return res.status(400).json({ ok: false, error: "missing orderId" });

    const { info, contact } = await getOrderInfoWithContact(orderId);
    if (!info || !contact) return res.status(404).json({ ok: false, error: "ไม่พบข้อมูลออเดอร์นี้" });

    const amount = (info.amountTotal || 0) - (info.amountPaid || 0);
    return res.json({
      ok: true,
      data: {
        tableNo: info.tableNo || null,
        customerName: contact.name || "",
        phone: contact.phone || "",
        amount: amount >= 0 ? amount : 0,
        note: "" // ให้แอดมินพิมพ์เอง
      }
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
}
