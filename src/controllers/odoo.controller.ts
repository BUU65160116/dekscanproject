import { Request, Response } from "express";
import { odooLogin, getCompanyId } from "../services/odoo";

/**
 * เดิม: router.get("/odoo/test", adminAuth, async (req, res) => {...})
 * ตอนนี้: ให้ routes เรียกฟังก์ชันนี้แทน
 */
export async function testOdoo(req: Request, res: Response) {
  try {
    const uid = await odooLogin();
    const companyId = await getCompanyId(uid);
    res.json({ ok: true, uid, companyId });
  } catch (err: any) {
    // ส่ง error กลับเหมือนเดิม
    res.status(500).json({ ok: false, error: err?.message || "unknown error" });
  }
}