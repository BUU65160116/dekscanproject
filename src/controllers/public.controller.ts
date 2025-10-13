// src/controllers/public.controller.ts
import { Request, Response } from "express";
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

  // เช็คอินวันนี้แล้วหรือยัง
  const checkedInToday = await hasCheckedInToday(user.CustomerID);

  return res.render("home", {
    shop: SHOP,
    user,
    points,
    checkedInToday,
    table: user.Table || "",
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

/* 
  ✅ ลบ/ย้ายแล้ว:
  - showPointsPage → ไปอยู่ src/controllers/points.controller.ts
  - redeemReward    → ไปอยู่ src/controllers/points.controller.ts
*/
