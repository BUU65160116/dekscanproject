// src/controllers/points.controller.ts
import { Request, Response } from "express";
import { pool } from "../services/db";
import { getTotalPoints } from "../services/points";

/** รายการของรางวัลที่อนุญาต (key -> label ที่จะเก็บใน DB/แสดงผล) */
const REWARDS: Record<string, string> = {
  DISCOUNT50: "ส่วนลด 50 บาท",
  ICE_BUCKET: "น้ำแข็ง 1 ถัง",
  COKE_1: "โค้ก 1 ขวด",
};

const COST = 10; // ใช้ 10 แต้มต่อการแลก 1 ครั้ง

/** GET /points  แสดงหน้าแต้ม + ปุ่มแลก + ประวัติแลก รายการล่าสุด */
export async function showPointsPage(req: Request, res: Response) {
  if (!req.session?.user) return res.redirect("/login");
  const user = req.session.user;

  // แต้มคงเหลือ
  const points = await getTotalPoints(user.CustomerID);

  // เช็คอินวันนี้หรือยัง (เพื่อโชว์ชิป “+1 แล้ว” บนหน้า)
  const [todayRows] = await pool.query<any[]>(
    "SELECT 1 FROM points_log WHERE CustomerID = ? AND LogDate = CURDATE() LIMIT 1",
    [user.CustomerID]
  );
  const checkedInToday = todayRows.length > 0;

  // ประวัติ “การแลก” รายการล่าสุด (มี Reward != NULL เท่านั้น)
  const [redeemLogs] = await pool.query<any[]>(
    `SELECT CreatedAt, Reward, Points
       FROM points_log
      WHERE CustomerID = ? AND Reward IS NOT NULL
      ORDER BY CreatedAt DESC
      LIMIT 1`,
    [user.CustomerID]
  );

  return res.render("points", {
    user,
    points,
    checkedInToday,
    redeemLogs,   // จะมี Reward, Points(เป็นค่าลบ -10), CreatedAt
    canRedeem: points >= COST,
  });
}

/** POST /points/redeem  รับตัวเลือกของรางวัลแล้วหักแต้ม 10 พร้อมบันทึก log */
export async function redeemReward(req: Request, res: Response) {
  if (!req.session?.user) return res.redirect("/login");
  const user = req.session.user;

  // อ่าน rewardType ที่ส่งมาจากฟอร์ม และตรวจว่าถูกต้องไหม
  const rewardType = String(req.body.rewardType || "");
  const rewardName = REWARDS[rewardType];
  if (!rewardName) {
    return res.status(400).send("ประเภทของรางวัลไม่ถูกต้อง");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ล็อกแต้มปัจจุบัน
    const [rows] = await conn.query<any[]>(
      "SELECT TotalPoints FROM points WHERE CustomerID = ? FOR UPDATE",
      [user.CustomerID]
    );
    const current = rows?.[0]?.TotalPoints ?? 0;

    if (current < COST) {
      await conn.rollback();
      return res.status(400).send("แต้มไม่พอสำหรับการแลก");
    }

    // หักแต้ม
    await conn.query(
      "UPDATE points SET TotalPoints = TotalPoints - ? WHERE CustomerID = ?",
      [COST, user.CustomerID]
    );

    // บันทึกลง points_log ของวันนี้ (รวมกับบรรทัดเช็คอินถ้ามีอยู่แล้ว)
    const [upd]: any = await conn.query(
      `UPDATE points_log
          SET Points = Points - ?, Reward = ?
        WHERE CustomerID = ? AND LogDate = CURDATE()`,
      [COST, rewardName, user.CustomerID]
    );

    if (upd.affectedRows === 0) {
      // วันนี้ยังไม่มี log → สร้างใหม่
      await conn.query(
        `INSERT INTO points_log (CustomerID, Points, Reward, LogDate, CreatedAt)
         VALUES (?, ?, ?, CURDATE(), NOW())`,
        [user.CustomerID, -COST, rewardName]
      );
    }

    await conn.commit();

    // ไปหน้า “แลกสำเร็จ”
    return res.render("redeem-success", {
      user,
      reward: rewardName,
      usedPoints: COST,
    });
  } catch (err) {
    console.error("redeemReward error:", err);
    await conn.rollback();
    return res.status(500).send("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  } finally {
    conn.release();
  }
}
