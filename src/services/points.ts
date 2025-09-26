import { pool } from "./db";

/** ✅ สร้าง row ใน points ถ้ายังไม่มี (เริ่ม 0 แต้ม) */
export async function ensurePointsRow(customerId: number) {
  await pool.query(
    "INSERT IGNORE INTO points (CustomerID, TotalPoints) VALUES (?, 0)",
    [customerId]
  );
}

/** ✅ ดึงแต้มปัจจุบันของลูกค้า */
export async function getTotalPoints(customerId: number): Promise<number> {
  const [rows] = await pool.query<any[]>(
    "SELECT TotalPoints FROM points WHERE CustomerID = ?",
    [customerId]
  );
  return rows.length > 0 ? Number(rows[0].TotalPoints || 0) : 0;
}

/**
 * ✅ ให้แต้ม 1 แต้ม ครั้งแรกของวัน (ระบบร้านเดียว)
 * - ถ้าเคยให้วันนี้แล้ว จะไม่เพิ่มซ้ำ
 * - ใช้ทรานแซกชันกัน race condition
 */
export async function awardCheckinIfFirstToday(
  customerId: number,
  tableId?: number | null
) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // พยายามจองสิทธิ์แต้มของวันนี้ ด้วย insert points_log รายวัน
    await conn.query(
      `INSERT INTO points_log (CustomerID, TableID, Points, LogDate)
       VALUES (?, ?, 1, CURRENT_DATE)`,
      [customerId, tableId ?? null]
    );

    // ถ้า insert ผ่าน แปลว่ายังไม่เคยได้แต้มวันนี้ → บวกแต้มรวม
    await conn.query(
      `UPDATE points
         SET TotalPoints = TotalPoints + 1
       WHERE CustomerID = ?`,
      [customerId]
    );

    await conn.commit();
    return { added: 1 };
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      // วันนี้ได้แต้มไปแล้ว → ไม่ถือว่า error
      await conn.rollback();
      return { added: 0 };
    }
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}