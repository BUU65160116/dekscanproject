import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // เช็กว่ามี session.user มั้ย
  if (req.session && req.session.user) {
    return next(); // ผ่าน → ไปต่อ
  }
  // ถ้ายังไม่ได้ login → เด้งกลับ login
  return res.redirect("/login");
}
