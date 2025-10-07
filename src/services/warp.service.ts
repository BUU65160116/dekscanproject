// ------------------------------------------------------------
// ฟังก์ชันหลักของฟีเจอร์ “แจกวาป”
//
// ทำอะไรได้บ้าง:
// 1) getBizDate()                  → วันที่ของร้าน (โซนไทย)
// 2) calcTotalCreditsFromOdoo()    → คิดสิทธิ์จากยอดวันนี้ (เวอร์ชันทดสอบ: ใช้ unpaid ชั่วคราว)
// 3) upsertDailyCredit()           → สร้าง/อัปเดตรายการใน warp_daily_credit
// 4) getCreditsForToday()          → อ่านเครดิตของวันนี้ (ไม่มีให้คำนวณแล้ว upsert ให้เลย)
// 5) consumeOneCredit()            → ใช้สิทธิ์ 1 ครั้ง + บันทึกเข้าคิว warp_queue (เริ่มต้นเป็น 'queued')
// ------------------------------------------------------------

import { pool } from "./db";
import { fetchUnpaidOrders } from "./odoo"; // ชั่วคราว: ใช้ดึงออเดอร์ที่ยังไม่จ่าย (เดี๋ยวค่อยอัปเป็นดึงทุกสถานะของวันนี้)
import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(tz);

const RATE = Number(process.env.WARP_PER_CREDIT || 250);   // ✅ ชื่อ ENV ที่ถูกต้อง
const TZ   = process.env.APP_TZ || "Asia/Bangkok";

/* -----------------------------------------------------------
   1) วันที่ของร้าน (โซนไทย)
----------------------------------------------------------- */
export function getBizDate(): string {
  return dayjs().tz(TZ).format("YYYY-MM-DD");
}

/* -----------------------------------------------------------
   2) คิดสิทธิ์จากยอดวันนี้ของโต๊ะ (เวอร์ชันทดสอบ)
   - ตอนนี้ใช้ fetchUnpaidOrders() (จึงรวมเฉพาะ "ที่ยังไม่ชำระ")
   - สเตปถัดไปจะเปลี่ยนเป็นดึง "ทุกสถานะของวันนี้" ผ่าน domain ช่วงเวลา
----------------------------------------------------------- */
export async function calcTotalCreditsFromOdoo(tableNo: number): Promise<number> {
  const all = await fetchUnpaidOrders(500); // ดึงกว้าง ๆ ก่อน
  const target = all.filter((r) => r.tableNo === tableNo);

  // รวมยอด (เฉพาะที่ยังไม่จ่าย) — พอให้เทสต์ flow ได้ก่อน
  const sumBaht = target.reduce((sum, r) => sum + (r.amountTotal ?? 0), 0);

  return Math.floor(sumBaht / RATE);
}

/* -----------------------------------------------------------
   3) สร้าง/อัปเดตตาราง warp_daily_credit
----------------------------------------------------------- */
export async function upsertDailyCredit(tableNo: number, bizDate: string, total: number): Promise<void> {
  await pool.query(
    `INSERT INTO warp_daily_credit (TableID, ForDate, CreditsTotal, CreditsUsed)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       CreditsTotal = VALUES(CreditsTotal),
       UpdatedAt    = NOW()`,
    [tableNo, bizDate, total]
  );
}

/* -----------------------------------------------------------
   4) อ่านเครดิตของโต๊ะวันนี้
      - ถ้ายังไม่มีแถว → คำนวณจาก Odoo แล้ว upsert ให้
----------------------------------------------------------- */
export async function getCreditsForToday(tableNo: number) {
  const bizDate = getBizDate();

  const [rows]: any = await pool.query(
    `SELECT CreditsTotal AS total, CreditsUsed AS used
       FROM warp_daily_credit
      WHERE TableID = ? AND ForDate = ?
      LIMIT 1`,
    [tableNo, bizDate]
  );

  if (rows.length) {
    const { total, used } = rows[0];
    return { total, used, left: Math.max(total - used, 0) };
  }

  // ยังไม่มี → คำนวณใหม่แล้วสร้าง
  const total = await calcTotalCreditsFromOdoo(tableNo);
  await upsertDailyCredit(tableNo, bizDate, total);
  return { total, used: 0, left: total };
}

/* -----------------------------------------------------------
   5) ใช้สิทธิ์ 1 ครั้ง + บันทึกเข้าคิว warp_queue (tx เดียว)
----------------------------------------------------------- */
export async function consumeOneCredit(
  tableNo: number,
  payload: { message: string; imageUrl?: string; customerId?: number }
) {
  const bizDate = getBizDate();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // ล็อกแถวเครดิตของวันนี้
    const [rows]: any = await conn.query(
      `SELECT CreditsTotal, CreditsUsed
         FROM warp_daily_credit
        WHERE TableID = ? AND ForDate = ?
        FOR UPDATE`,
      [tableNo, bizDate]
    );

    let total = 0;
    let used  = 0;

    if (rows.length === 0) {
      // ยังไม่มีเครดิตวันนี้ → คำนวณใหม่แล้วแทรก
      total = await calcTotalCreditsFromOdoo(tableNo);
      await conn.query(
        `INSERT INTO warp_daily_credit (TableID, ForDate, CreditsTotal, CreditsUsed)
         VALUES (?, ?, ?, 0)`,
        [tableNo, bizDate, total]
      );
    } else {
      total = rows[0].CreditsTotal;
      used  = rows[0].CreditsUsed;
    }

    const left = Math.max(total - used, 0);
    if (left <= 0) throw new Error("สิทธิ์ไม่พอ");

    // หักสิทธิ์
    await conn.query(
      `UPDATE warp_daily_credit
          SET CreditsUsed = CreditsUsed + 1,
              UpdatedAt    = NOW()
        WHERE TableID = ? AND ForDate = ?`,
      [tableNo, bizDate]
    );

    // เข้าคิว
    const [insert]: any = await conn.query(
      `INSERT INTO warp_queue (TableID, CustomerID, Message, ImageURL, Status)
       VALUES (?, ?, ?, ?, 'queued')`,
      [tableNo, payload.customerId || null, payload.message, payload.imageUrl || null]
    );

    await conn.commit();
    return { left: left - 1, queueId: insert.insertId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}