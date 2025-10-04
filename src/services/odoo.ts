// Service กลางสำหรับเรียก Odoo JSON-RPC (Node 18+ ใช้ fetch ได้เลย)

import assert from "node:assert";

// ดึงค่า ENV (ต้องถูกเติมใน .env ของโปรเจกต์อยู่แล้ว)
const ODOO_URL = process.env.ODOO_URL!;     // เช่น https://<subdomain>.odoo.com/jsonrpc
const ODOO_DB = process.env.ODOO_DB!;       // ชื่อ DB ของ Odoo instance (เช่น mybar)
const ODOO_LOGIN = process.env.ODOO_LOGIN!; // อีเมลผู้ใช้ที่ออก API Key
const ODOO_API_KEY = process.env.ODOO_API_KEY!; // API Key ที่สร้างจาก Odoo

// หมายเหตุ type ง่าย ๆ สำหรับ JSON-RPC
type JsonRpcReq = {
  jsonrpc: "2.0";
  method: "call";
  params: { service: string; method: string; args: any[] };
  id: number;
};
type JsonRpcRes<T = any> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: any };
};

// ฟังก์ชันเรียก JSON-RPC ไป Odoo (ตัวเดียวใช้ซ้ำได้ทั้งโปรเจกต์)
async function rpc<T = any>(service: string, method: string, args: any[]): Promise<T> {
  // กันลืมใส่ ENV
  assert(ODOO_URL && ODOO_DB && ODOO_LOGIN && ODOO_API_KEY, "Missing Odoo env");

  // (ถ้าใช้ Node < 18) ปลดคอมเมนต์สองบรรทัดนี้ แล้ว `npm i node-fetch`:
  // const fetchMod = await import("node-fetch");
  // const fetch = (fetchMod.default as any) as typeof globalThis.fetch;

  const body: JsonRpcReq = {
    jsonrpc: "2.0",
    method: "call",
    params: { service, method, args },
    id: Date.now(), // ใช้เวลาปัจจุบันเป็น id request
  };

  const res = await fetch(ODOO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // เผื่อ Odoo down หรือเน็ตล้ม
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Odoo HTTP ${res.status} ${res.statusText} ${text}`);
  }

  const json = (await res.json()) as JsonRpcRes<T>;
  // กรณีสิทธิ์ไม่พอ / domain ผิด / ฯลฯ
  if (json.error) {
    throw new Error(`Odoo RPC error: ${json.error.message}`);
  }
  return json.result as T;
}

// 1) login -> ได้ uid (ต้องเรียกก่อนทุกครั้ง)
export async function odooLogin(): Promise<number> {
  // service "common" method "login" => args = [db, login, apiKey]
  return rpc<number>("common", "login", [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY]);
}

// 2) อ่าน company_id จากโมเดล pos.config (ไว้ประกอบ context multi-company)
export async function getCompanyId(uid: number): Promise<number> {
  const res = await rpc<any[]>("object", "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    "pos.config",
    "search_read",
    [[]], // domain ว่าง = ดึงทั้งหมด แล้วไป limit ใน kwargs
    { fields: ["id", "name", "company_id"], limit: 1 },
  ]);

  if (!Array.isArray(res) || !res.length) {
    throw new Error("No pos.config found");
  }
  // many2one จะเป็นรูป [id, display_name]
  return res[0].company_id[0];
}

// (ตัวช่วย) สร้าง context บริษัทตาม company_id — จะใช้ในสเตปถัดไป
export function buildCompanyContext(companyId: number) {
  return {
    allowed_company_ids: [companyId],
    company_id: companyId,
    tz: process.env.APP_TZ || "Asia/Bangkok",   
  };
}

// TODO(สเตป 3.2): จะเพิ่มฟังก์ชัน fetchOrders() / fetchUnpaid() ที่นี่

// ===== [STEP 3.2.1] ดึงรายการโต๊ะค้างจาก Odoo =====

// รูปแบบข้อมูลที่ฝั่งแดชบอร์ดอยากได้ (สรุปแล้วอ่านง่าย)
export type UnpaidOrder = {
  orderId: number;
  tableLabel: string;         // ตัวอย่าง: "mybar, 7"
  tableNo: number | null;     // 7 (ตัดเลขออกมา ถ้าไม่ได้ให้เป็น null)
  amountTotal: number;        // ยอดรวม
  amountPaid: number;         // ยอดที่จ่ายแล้ว
  amountDue: number;          // ค้างชำระ = Total - Paid
  state: string;              // ปกติจะเป็น "draft"
  dateOrderUtc: string | null; // เวลาท้องถิ่นตาม tz ที่ส่งให้ Odoo (เช่น Asia/Bangkok)
};

/**
 * ดึง "ออเดอร์ล่าสุด" จาก pos.order แล้วกรองให้เหลือ
 *   - มี table_id
 *   - state ไม่ใช่ "paid"/"done"
 * คืนข้อมูลแบบ UnpaidOrder[] สำหรับใช้บนแดชบอร์ด
 *
 * หมายเหตุ:
 * - Odoo ส่ง date_order เป็น UTC string (เช่น "2025-10-02 02:09:21"),
 *   ฝั่ง UI ค่อยแปลงเป็น Asia/Bangkok ตอนแสดงผล
 */
export async function fetchUnpaidOrders(limit = 300): Promise<UnpaidOrder[]> {
  // 1) login → uid
  const uid = await odooLogin();

  // 2) company_id → เอาไว้ประกอบ context ป้องกัน record rule ของ multi-company
  const companyId = await getCompanyId(uid);
  const ctx = buildCompanyContext(companyId);

  // 3) ดึงออเดอร์ล่าสุดจาก pos.order
  //    - ดึงกว้าง ๆ แล้วไปกรองฝั่งเรา (ปลอดภัยกับบางเวอร์ชันที่ไม่ชอบ domain ซับซ้อน)
  const rows = await rpc<any[]>("object", "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    "pos.order",
    "search_read",
    [[]], // domain ว่างไว้ แล้วใช้ order/limit แทน
    {
      fields: ["id", "name", "state", "table_id", "amount_total", "amount_paid", "date_order"],
      order: "id desc",
      limit,
      context: ctx,
    },
  ]);

  // 4) กรอง: ต้องมี table_id และ state ไม่ใช่ paid/done
  const filtered = rows.filter((r) => {
    const hasTable = Array.isArray(r.table_id) && r.table_id.length >= 2; // [id, display_name]
    const notPaid = r.state !== "paid" && r.state !== "done";
    return hasTable && notPaid;
  });

  // 5) map ให้อยู่ในรูปแบบที่แดชบอร์ดใช้สะดวก
  const result: UnpaidOrder[] = filtered.map((r) => {
    const tableLabel: string = r.table_id?.[1] ?? ""; // display name เช่น "mybar, 7"
    const tableNo = parseTableNo(tableLabel);
    const amountTotal = Number(r.amount_total ?? 0);
    const amountPaid = Number(r.amount_paid ?? 0);
    return {
      orderId: r.id,
      tableLabel,
      tableNo,
      amountTotal,
      amountPaid,
      amountDue: +(amountTotal - amountPaid).toFixed(2),
      state: r.state,
      dateOrderUtc: r.date_order ?? null,  // ตอนนี้ Odoo แปลงเป็นเวลา Local ตาม tz แล้ว ไม่ใช่ UTC
    };
  });

  return result;
}

// ตัวช่วย: ตัดเลขโต๊ะจาก display_name เช่น "mybar, 7" → 7
function parseTableNo(label: string): number | null {
  // พยายามจับเลขท้ายสุดในสตริง
  const m = label.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

// ดึงข้อมูล order เดี่ยว เพื่อดูว่าเป็นโต๊ะอะไร =====

export type OrderInfo = {
  orderId: number;
  tableLabel: string;
  tableNo: number | null;
  amountTotal: number;
  amountPaid: number;
  dateOrderUtc: string | null;
  state: string;
};

// ดึง order ตาม id (ใช้ตอนจะแสดงข้อมูลติดต่อให้โต๊ะนั้น)
export async function fetchOrderInfo(orderId: number): Promise<OrderInfo | null> {
  const uid = await odooLogin();
  const companyId = await getCompanyId(uid);
  const ctx = buildCompanyContext(companyId);

  const rows = await rpc<any[]>("object", "execute_kw", [
    ODOO_DB, uid, ODOO_API_KEY,
    "pos.order", "search_read",
    [[["id", "=", orderId]]],
    { fields: ["id","state","table_id","amount_total","amount_paid","date_order"], limit: 1, context: ctx }
  ]);

  if (!rows || !rows.length) return null;

  const r = rows[0];
  const tableLabel: string = r.table_id?.[1] ?? "";
  const tableNo = parseTableNo(tableLabel);
  const toNum = (v:any) => Number.parseFloat(String(v)) || 0;

  return {
    orderId: r.id,
    tableLabel,
    tableNo,
    amountTotal: toNum(r.amount_total),
    amountPaid:  toNum(r.amount_paid),
    dateOrderUtc: (r.date_order ?? null) as string | null,
    state: r.state,
  };
}

