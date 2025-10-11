import { fetchUnpaidOrders, fetchOrderInfo, UnpaidOrder } from "../services/odoo";
import { findLatestContactByTableNo } from "../services/contact";

// ---------- In-memory cache ----------
type CacheShape = { at: number; data: UnpaidOrder[] };
const CACHE: CacheShape = { at: 0, data: [] };
const TTL_MS = 15_000; // 15 วินาที (เหมือนของเดิม)

export type DashboardUnpaidRow = {
  orderId: number;
  tableNo: number | null;     // คง type เดิม
  tableLabel: string;         // คง type เดิม
  amountDue: number;
  state: string;
  dateOrderUtc: string | null;
};

// map ข้อมูลให้ตรงกับ dashboard เดิม
export function mapForDashboard(list: UnpaidOrder[]): DashboardUnpaidRow[] {
  return list.map((r) => ({
    orderId: r.orderId,
    tableNo: r.tableNo ?? null,
    tableLabel: r.tableLabel,
    amountDue: r.amountDue,
    state: r.state,
    dateOrderUtc: r.dateOrderUtc ?? null,
  }));
}

/** ดึงรายการค้างชำระ (มี cache) ให้หน้า Dashboard */
export async function getUnpaidList(limit: number): Promise<{ data: DashboardUnpaidRow[]; cached: boolean; count: number; }> {
  const now = Date.now();
  const useCache = now - CACHE.at < TTL_MS && CACHE.data.length > 0;

  if (useCache) {
    const data = mapForDashboard(CACHE.data);
    return { data, cached: true, count: CACHE.data.length };
  }

  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 300));
  const list = await fetchUnpaidOrders(safeLimit);
  CACHE.at = now;
  CACHE.data = list;

  const data = mapForDashboard(list);
  return { data, cached: false, count: list.length };
}

/** ดึงรายละเอียดออเดอร์ + contact (ใช้กับหน้า “ข้อมูลติดต่อ”) */
export async function getOrderInfoWithContact(orderId: number) {
  const info = await fetchOrderInfo(orderId);   // { orderId, tableNo, ... }
  if (!info) return { info: null, contact: null };

  let contact: { name: string; phone: string } | null = null;
  if (info.tableNo != null) {
    contact = await findLatestContactByTableNo(info.tableNo); // tableNo = number
  }
  return { info, contact };
}

/** ออปชัน: ให้ admin เคลียร์ cache ได้ */
export function clearUnpaidCache() {
  CACHE.at = 0;
  CACHE.data = [];
}