// ดึงข้อมูลติดต่อ (ชื่อ/เบอร์) ของลูกค้าล่าสุดที่สแกน "โต๊ะนั้น" จาก DB จริงของคุณ
import { pool } from "./db";

export type ContactInfo = { name: string; phone: string } | null;

/**
 * tableNo = เลขโต๊ะจาก Odoo (1..10) == TableID ใน tableqr ของคุณ
 * ใช้ scanlog.ScanTime เป็นตัวจัดลำดับล่าสุด
 */
export async function findLatestContactByTableNo(tableNo: number): Promise<ContactInfo> {
  const sql = `
    SELECT c.Name AS name, c.PhoneNumber AS phone
    FROM scanlog s
    JOIN tableqr t ON t.TableID = s.TableID
    JOIN customer c ON c.CustomerID = s.CustomerID
    WHERE t.TableID = ?
    ORDER BY s.ScanTime DESC
    LIMIT 1 
  `; // ^^เเสดงรายชื่อคนในโต๊ะที่เเสกน หน้าข้อมูลติดต่อ LIMIT 1
  try {
    const [rows] = await pool.query(sql, [tableNo]);
    const r: any = (Array.isArray(rows) && rows.length) ? rows[0] : null;
    if (!r) return null;
    return { name: r.name ?? "ไม่ระบุ", phone: r.phone ?? "-" };
  } catch (err) {
    console.error("[contact] query error:", err);
    return null; // กันพังหน้าแอดมิน
  }
}
