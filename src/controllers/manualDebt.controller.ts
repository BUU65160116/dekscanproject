// จัดการ HTTP ของ manual_debt (เพิ่ม/ดึง/แก้ไข/เพิ่มแบบหลายคน)
import { Request, Response } from "express";
import {
  createManualDebt,
  listOpenManualDebt,
  updateManualDebt,
  bulkCreateManualDebt,   
} from "../services/manualDebt.service";

// POST /admin/manual-debt/create (บันทึกเดี่ยว)
export async function postCreateManualDebt(req: Request, res: Response) {
  try {
    const { tableNo, customerName, phone, amount, note } = req.body || {};
    if (!customerName || !phone) {
      return res.status(400).json({ ok: false, error: "กรอกชื่อ/เบอร์ให้ครบ" });
    }
    const amt = Number(amount);
    if (!isFinite(amt) || amt < 0) {
      return res.status(400).json({ ok: false, error: "จำนวนเงินไม่ถูกต้อง" });
    }
    const debtId = await createManualDebt({
      TableID: tableNo != null ? Number(tableNo) : null,
      CustomerName: String(customerName),
      Phone: String(phone),
      Amount: amt,
      Note: note ? String(note) : undefined,
    });
    return res.json({ ok: true, debtId });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "error" });
  }
}

// GET /admin/manual-debt/list?limit=100
export async function getOpenManualDebt(req: Request, res: Response) {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 100));
    const data = await listOpenManualDebt(limit);
    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "error" });
  }
}

// POST /admin/manual-debt/update
export async function postUpdateManualDebt(req: Request, res: Response) {
  try {
    const { debtId, customerName, phone, amount, note, status } = req.body || {};
    if (!debtId) return res.status(400).json({ ok: false, error: "missing debtId" });
    if (!customerName || !phone) {
      return res.status(400).json({ ok: false, error: "กรอกชื่อ/เบอร์ให้ครบ" });
    }
    const amt = Number(amount);
    if (!isFinite(amt) || amt < 0) {
      return res.status(400).json({ ok: false, error: "จำนวนเงินไม่ถูกต้อง" });
    }
    const st = String(status) === "resolved" ? "resolved" : "open";
    await updateManualDebt({
      DebtID: Number(debtId),
      CustomerName: String(customerName),
      Phone: String(phone),
      Amount: amt,
      Note: note ? String(note) : undefined,
      Status: st as "open" | "resolved",
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "error" });
  }
}

// POST /admin/manual-debt/bulk-create (บันทึกหลายคนในโต๊ะครั้งเดียว)
export async function postBulkCreateManualDebt(req: Request, res: Response) {
  try {
    const { tableNo, amount, note, people } = req.body || {};
    const amt = Number(amount);
    if (!isFinite(amt) || amt < 0) {
      return res.status(400).json({ ok: false, error: "จำนวนเงินไม่ถูกต้อง" });
    }
    if (!Array.isArray(people) || people.length === 0) {
      return res.status(400).json({ ok: false, error: "ไม่มีรายชื่อคนในโต๊ะ" });
    }
    // ทำความสะอาดรายชื่อ
    const cleaned = people
      .map((p: any) => ({
        CustomerName: String(p?.customerName || "").trim(),
        Phone: String(p?.phone || "").trim(),
      }))
      .filter((p: any) => p.CustomerName && p.Phone);

    if (cleaned.length === 0) {
      return res.status(400).json({ ok: false, error: "ข้อมูลลูกค้าไม่ครบ" });
    }

    const inserted = await bulkCreateManualDebt({
      TableID: tableNo != null ? Number(tableNo) : null,
      Amount: amt,
      Note: note ? String(note) : null,
      People: cleaned,
    });

    return res.json({ ok: true, inserted });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "error" });
  }
}
