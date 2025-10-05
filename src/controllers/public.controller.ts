import { Request, Response } from "express";
import { getTotalPoints, hasCheckedInToday } from "../services/points";

const SHOP = process.env.SHOP_CODE || "MYBAR";

/** GET /home */
export async function showHome(req: Request, res: Response) {
  // กันกรณียังไม่ล็อกอิน (คงเดิม)
  if (!req.session?.user) return res.redirect("/login");

  // รองรับ /home?table=... (คงเดิม)
  const q = req.query.table;
  if (typeof q === "string" && q.length > 0) {
    req.session.user.Table = q;
    if (/^\d+$/.test(q)) {
      req.session.tableId = Number(q);
    }
  }

  const user = req.session.user;
  const points = await getTotalPoints(user.CustomerID);

  // เช็คอินวันนี้แล้วหรือยัง (เดิม query โดยตรง → ย้ายเข้า service)
  const checkedInToday = await hasCheckedInToday(user.CustomerID);

  return res.render("home", {
    shop: SHOP,
    user,
    points,
    checkedInToday,
    table: user.Table || "",
  });
}

/** GET /points (stub เดิม) */
export async function showPointsPage(req: Request, res: Response) {
  const user = req.session.user;
  return res.render("points", { user });
}

/** GET /warp (stub เดิม) */
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