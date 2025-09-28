import { Request, Response, NextFunction } from "express";

/**
 * adminAuth
 * - ถ้า req.session.isAdmin เป็นจริง → ผ่าน (next)
 * - ถ้าไม่ → redirect ไป /admin/login
 */
function adminAuth(req: Request, res: Response, next: NextFunction) {
  // เช็คว่ามี session และเป็นแอดมินหรือไม่
  if (req.session?.isAdmin) {
    return next();
  }
  // ถ้ายังไม่ได้ล็อกอินเป็นแอดมิน → เด้งกลับหน้า login
  return res.redirect("/admin/login");
}

export default adminAuth;
