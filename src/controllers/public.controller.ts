import { Request, Response } from "express";
import { pool } from "../services/db";
import { getTotalPoints, hasCheckedInToday } from "../services/points";

const SHOP = process.env.SHOP_CODE || "MYBAR";

/** GET /home */
export async function showHome(req: Request, res: Response) {
  // กันกรณียังไม่ล็อกอิน 
  if (!req.session?.user) return res.redirect("/login");

  // รองรับ /home?table=... 
  const q = req.query.table;
  if (typeof q === "string" && q.length > 0) {
    req.session.user.Table = q;
    if (/^\d+$/.test(q)) {
      req.session.tableId = Number(q);
    }
  }

  const user = req.session.user;
  const points = await getTotalPoints(user.CustomerID);

  // เช็คอินวันนี้แล้วหรือยัง (ย้ายมาใช้ service)
  const checkedInToday = await hasCheckedInToday(user.CustomerID);

  return res.render("home", {
    shop: SHOP,
    user,
    points,
    checkedInToday,
    table: user.Table || "",
  });
}

/** GET /points */
export async function showPointsPage(req: Request, res: Response) {
  const user = req.session.user!;
  // === [POINTS FEATURE] ดึงแต้มคงเหลือและประวัติ ===
  const points = await getTotalPoints(user.CustomerID);

  // เช็คอินวันนี้หรือยัง
  const [todayRows] = await pool.query<any[]>(
    "SELECT 1 FROM points_log WHERE CustomerID = ? AND LogDate = CURDATE() LIMIT 1",
    [user.CustomerID]
  );
  const checkedInToday = todayRows.length > 0;

  // 5 รายการ “การแลก” ล่าสุดเท่านั้น
  // เกณฑ์: Points <= -9 (เพราะถ้าวันนั้นเช็คอินก่อน +1 แล้วแลก -10 จะกลายเป็น -9)
  const [redeemLogs] = await pool.query<any[]>(
    `SELECT LogDate, Points, CreatedAt
       FROM points_log
      WHERE CustomerID = ?
        AND Points <= -9
      ORDER BY CreatedAt DESC
      LIMIT 5`,
    [user.CustomerID]
  );

  return res.render("points", {
    user,
    points,
    checkedInToday,
    redeemLogs,
  });
}

/** GET /warp */
export function showWarpPage(req: Request, res: Response) {
  const user = req.session.user;
  return res.render("warp", { user, shop: SHOP });
}

/** GET /logout */
export function logout(req: Request, res: Response) {
  req.session.destroy(err => {
    if (err) {
      console.error("logout error:", err);
    }
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
}

// === [POINTS FEATURE] POST /redeem ===
// ฟังก์ชันแลกของรางวัลเมื่อแต้ม ≥ 10
export const redeemReward = async (req: Request, res: Response) => {
  const user = req.session.user!;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    //  ล็อกแต้มรวมปัจจุบัน
    const [rows] = await conn.query<any[]>(
      "SELECT TotalPoints FROM points WHERE CustomerID = ? FOR UPDATE",
      [user.CustomerID]
    );
    const current = rows?.[0]?.TotalPoints ?? 0;

    if (current < 10) {
      await conn.rollback();
      // แต้มไม่พอ → แสดงหน้า points เดิม
      const [todayRows] = await conn.query<any[]>(
        "SELECT 1 FROM points_log WHERE CustomerID = ? AND LogDate = CURDATE() LIMIT 1",
        [user.CustomerID]
      );
      const checkedInToday = todayRows.length > 0;
      const [logs] = await conn.query<any[]>(
        `SELECT LogDate, Points, TableID, CreatedAt
           FROM points_log
          WHERE CustomerID = ?
          ORDER BY CreatedAt DESC
          LIMIT 20`,
        [user.CustomerID]
      );
      return res.status(400).render("points", {
        user,
        points: current,
        checkedInToday,
        logs,
        error: "แต้มไม่พอสำหรับการแลก (ต้องมีอย่างน้อย 10 แต้ม)",
      });
    }

    //  หักแต้ม 10
    await conn.query(
      "UPDATE points SET TotalPoints = TotalPoints - 10 WHERE CustomerID = ?",
      [user.CustomerID]
    );

    //  บันทึก log — รวมแถวของวันเดียวกัน
    const [upd]: any = await conn.query(
      `UPDATE points_log
         SET Points = Points - 10, CreatedAt = NOW()
       WHERE CustomerID = ? AND LogDate = CURDATE()`,
      [user.CustomerID]
    );

    if (upd.affectedRows === 0) {
      await conn.query(
        `INSERT INTO points_log (CustomerID, Points, LogDate, CreatedAt)
         VALUES (?, -10, CURDATE(), NOW())`,
        [user.CustomerID]
      );
    }

    await conn.commit();

    //  แสดงหน้าแลกสำเร็จ
    return res.render("redeem-success", {
      user,
      reward: "ส่วนลด 50 บาท หรือเครื่องดื่ม 1 แก้ว",
      usedPoints: 10,
    });
  } catch (err) {
    console.error("redeemReward error:", err);
    await conn.rollback();
    return res.status(500).send("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  } finally {
    conn.release();
  }
};