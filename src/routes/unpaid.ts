// Route กลุ่ม “ค้างชำระ” สำหรับหน้า Dashboard (Admin)

import { Router } from "express";
import  adminAuth  from "../middlewares/adminAuth";
import { fetchUnpaidOrders, UnpaidOrder, fetchOrderInfo } from "../services/odoo";
import { findLatestContactByTableNo } from "../services/contact";

const router = Router();

// ---------- In-memory cache (ลดการยิง RPC ถี่) ----------
type CacheShape = { at: number; data: UnpaidOrder[] };
const CACHE: CacheShape = { at: 0, data: [] };
const TTL_MS = 15_000; // 15 วินาที

type DashboardUnpaidRow = {
  orderId: number;
  tableNo: number | null;
  tableLabel: string;
  amountDue: number;
  state: string;
  dateOrderUtc: string | null;
};

// ---------- GET /admin/unpaid/data ----------
router.get("/unpaid/data", adminAuth, async (req, res) => {
  try {
    const now   = Date.now();
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 300));

    if (now - CACHE.at < TTL_MS && CACHE.data.length) {
      return res.json({ ok: true, data: mapForDashboard(CACHE.data), meta: { cached: true, count: CACHE.data.length } });
    }

    const list = await fetchUnpaidOrders(limit);
    CACHE.at   = now;
    CACHE.data = list;

    return res.json({ ok: true, data: mapForDashboard(list), meta: { cached: false, count: list.length } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

function mapForDashboard(list: UnpaidOrder[]): DashboardUnpaidRow[] {
  return list.map(r => ({
    orderId: r.orderId,
    tableNo: r.tableNo,
    tableLabel: r.tableLabel,
    amountDue: r.amountDue,
    state: r.state,
    dateOrderUtc: r.dateOrderUtc ?? null,
  }));
}

// ---------- POST /admin/unpaid/contact/view ----------
// ตรวจ PIN + เปิดหน้า “ข้อมูลติดต่อ” ของโต๊ะนั้น (render view)
const ADMIN_PIN = process.env.ADMIN_CONTACT_PIN || "";

router.post("/unpaid/contact/view", adminAuth, async (req, res) => {
  try {
    const { orderId, pin } = req.body || {};
    if (!orderId) return res.status(400).send("missing orderId");
    if (!pin || pin !== ADMIN_PIN) return res.status(403).send("PIN ไม่ถูกต้อง");

    const info = await fetchOrderInfo(Number(orderId));
    if (!info) return res.status(404).send("ไม่พบออเดอร์นี้");

    let contact = null;
    if (info.tableNo != null) {
      contact = await findLatestContactByTableNo(info.tableNo);
    }

    return res.render("admin/contact", {
      title: `ข้อมูลติดต่อ | โต๊ะ ${info.tableNo ?? "-"}`,
      order: info,
      contact, // { name, phone } | null
    });
  } catch (err: any) {
    res.status(500).send(err?.message || "error");
  }
});

export default router;
