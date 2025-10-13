// ดึงข้อมูลติดต่อ (ชื่อ/เบอร์) ของลูกค้าที่สแกน "โต๊ะนั้น" วันนี้
// - เพิ่มฟังก์ชันแบบคืนค่าเป็น "หลายคน" (เรียงเวลาล่าสุดก่อน)
// - คงฟังก์ชันเดิม findLatestContactByTableNo ไว้ (ให้คืนแค่คนแรกของวันนี้เพื่อความเข้ากันได้)
// - หมายเหตุ: เงื่อนไข "วันนี้" อิง CURRENT_DATE() ของ MySQL/เซิร์ฟเวอร์ DB
//   ถ้าเซิร์ฟเวอร์ตั้ง timezone = Asia/Bangkok อยู่แล้วจะตรงกับเวลาจริง
//   ถ้าต้องล็อคช่วงเวลาเอง (เช่นตามรอบร้าน) ให้เปลี่ยน WHERE เป็นพารามิเตอร์ start/end ได้
import { pool } from "./db";

export type ContactInfo = {
  name: string;
  phone: string;
  lastScan?: string; // เวลา scan ล่าสุดของลูกค้าคนนั้นในวันนี้ (เผื่ออยากโชว์)
};

// ===========================
// ฟังก์ชันหลัก: ดึง "ทุกคนที่สแกนวันนี้" ของโต๊ะนั้น (ไม่ซ้ำคน)
// ===========================
export async function findContactsByTableToday(tableNo: number): Promise<ContactInfo[]> {
  const sql = `
    SELECT 
      c.Name        AS name,
      c.PhoneNumber AS phone,
      MAX(s.ScanTime) AS lastScan
    FROM scanlog s
    JOIN tableqr t   ON t.TableID = s.TableID
    JOIN customer c  ON c.CustomerID = s.CustomerID
    WHERE t.TableID = ?
      AND s.ScanTime >= CURRENT_DATE()
      AND s.ScanTime  < CURRENT_DATE() + INTERVAL 1 DAY
    GROUP BY c.CustomerID, c.Name, c.PhoneNumber
    ORDER BY MAX(s.ScanTime) DESC
  `;
  // อธิบาย:
  // - GROUP BY ตาม CustomerID (ผ่านฟิลด์จากตาราง customer) เพื่อ "ไม่ซ้ำคน"
  // - MAX(ScanTime) = เวลา scan ล่าสุดของคนนั้นในวันนี้
  // - ORDER BY เวลาล่าสุดจากมากไปน้อย → คนที่เพิ่งสแกนอยู่บนสุด

  try {
    const [rows] = await pool.query(sql, [tableNo]);
    // rows จะเป็นอาเรย์ของลูกค้าที่สแกนวันนี้ (0 รายการได้ ถ้ายังไม่มีใครสแกน)
    return Array.isArray(rows)
      ? rows.map((r: any) => ({
          name: r.name ?? "ไม่ระบุ",
          phone: r.phone ?? "-",
          lastScan: r.lastScan ?? undefined,
        }))
      : [];
  } catch (err) {
    console.error("[contact] query error:", err);
    return []; // กันพัง: คืนลิสต์ว่างแทน
  }
}

// ===============================================
// ฟังก์ชันเดิม: คืน "คนล่าสุดของวันนี้" (เผื่อโค้ดเดิมยังเรียกใช้)
// ตอนนี้เราให้มันเรียกใช้ list ข้างบน แล้วหยิบตัวแรกมา
// ===============================================
export async function findLatestContactByTableNo(tableNo: number): Promise<ContactInfo | null> {
  try {
    const list = await findContactsByTableToday(tableNo);
    return list.length ? list[0] : null;
  } catch (err) {
    console.error("[contact/latest] error:", err);
    return null;
  }
}
