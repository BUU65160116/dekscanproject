
import { Router, Request, Response } from "express";
import "dotenv/config";                 // โหลดตัวแปรจาก .env
import adminAuth from "../middlewares/adminAuth"; // มิดเดิลแวร์เช็คสิทธิ์แอดมิน

const router = Router();

/**
 * GET /admin/login
 * แสดงหน้าแบบฟอร์มเข้าสู่ระบบแอดมิน
 */
router.get("/login", (req: Request, res: Response) => {
  // ส่งตัวแปร error = null ไปก่อน (ถ้ามี error จะใส่ตอน login ไม่ผ่าน)
  return res.render("admin/login", { error: null });
});

/**
 * POST /admin/login
 * ตรวจ username/password จาก .env แล้วตั้งค่า session.isAdmin
 */
router.post("/login", (req: Request, res: Response) => {
  // ดึงค่าจากฟอร์ม
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  // ค่าที่ตั้งไว้ใน .env
  const ADMIN_USER = process.env.ADMIN_USER ?? "";
  const ADMIN_PASS = process.env.ADMIN_PASS ?? "";

  // ตรวจตรง ๆ แบบง่าย (ถ้าต้องการ hashing ค่อยปรับทีหลัง)
  const isValid =
    (username ?? "").trim() === ADMIN_USER &&
    (password ?? "") === ADMIN_PASS;

  if (!isValid) {
    // ถ้าไม่ผ่าน: คืน 401 + แสดงหน้าล็อกอินพร้อม error
    return res
      .status(401)
      .render("admin/login", { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }

  // ถ้าผ่าน: ตั้ง flag ว่าเป็นแอดมิน
  req.session.isAdmin = true;

  // เซฟ session ให้เรียบร้อยก่อน redirect (กัน race condition)
  return req.session.save(() => res.redirect("/admin/dashboard"));
});

/**
 * GET /admin/dashboard
 * หน้าแดชบอร์ด (ยังเป็น placeholder) — ป้องกันด้วย adminAuth
 */
router.get("/dashboard", adminAuth, (req: Request, res: Response) => {
  return res.render("admin/dashboard"); // ส่งไปที่ EJS
});

/**
 * POST /admin/logout
 * ออกจากระบบ: เคลียร์/ทำลาย session แล้วเด้งกลับหน้า login
 */
router.post("/logout", (req: Request, res: Response) => {
  // กันเผื่อ: เคลียร์ flag แอดมิน
  req.session.isAdmin = false;

  // ทำลายทั้ง session
  return req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

export default router;
