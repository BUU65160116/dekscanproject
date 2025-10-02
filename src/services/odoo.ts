// src/services/odoo.ts
// Service ส่วนกลางสำหรับเรียก Odoo JSON-RPC
// --------------------------------------------------

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
  return { allowed_company_ids: [companyId], company_id: companyId };
}

// TODO(สเตป 3.2): จะเพิ่มฟังก์ชัน fetchOrders() / fetchUnpaid() ที่นี่
