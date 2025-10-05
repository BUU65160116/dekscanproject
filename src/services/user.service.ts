import { pool } from "./db";
import { ResultSetHeader } from "mysql2";

// ใช้แทน pool.query สำหรับ SELECT (คืน rows ตามเดิม)
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

// ใช้แทน pool.query สำหรับ INSERT/UPDATE/DELETE (อยากได้ insertId/affectedRows)
export async function exec(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const [res] = await pool.query<ResultSetHeader>(sql, params);
  return res;
}

/* ===== ตัวอย่างฟังก์ชันเฉพาะโดเมน (ยังไม่บังคับใช้) =====
   ถ้าใน user.controller.ts มีคิวรีเหล่านี้อยู่แล้ว ค่อย ๆ ย้ายมาได้ทีหลังแบบ 1:1

export async function findUserByPhone(phone: string) {
  const rows = await query<any>("SELECT * FROM users WHERE phone = ?", [phone]);
  return rows[0] ?? null;
}

export async function createUser(phone: string, tableId: number | null) {
  return exec("INSERT INTO users(phone, table_id) VALUES(?,?)", [phone, tableId]);
}
*/