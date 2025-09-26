import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth"; // ✅ import middleware ที่เราสร้างไว้
import { getTotalPoints } from "../services/points"; 

const SHOP = process.env.SHOP_CODE || "MYBAR";
const router = Router();

// เมื่อลูกค้าสแกน จะเข้าหน้า Login ก่อนเสมอ
router.get("/login", showLogin);
router.post("/login", submitLogin);

// แสดงหน้า Register 
router.get("/register", showRegister);
router.post("/register", submitRegister);

router.get("/home", async (req, res) => {
  // กันกรณียังไม่ล็อกอิน
  if (!req.session?.user) return res.redirect("/login");

  const user = req.session.user;
  const points = await getTotalPoints(user.CustomerID); // ✅ query แต้มปัจจุบัน

  res.render("home", {
    user,
    points,
    shop: SHOP,               // ✅ ร้านเดียว
    table: user.Table || "",
  });
});

// ออกจากระบบ
router.get("/logout", (req, res) => {
  // ทำลาย session ฝั่งเซิร์ฟเวอร์
  req.session.destroy(err => {
    if (err) {
      console.error("logout error:", err);
      // เผื่อกรณี destroy มีปัญหา ให้ส่งกลับหน้า login อยู่ดี
    }
    // ลบคุกกี้ session ฝั่งเบราว์เซอร์ (ชื่อปกติคือ connect.sid ถ้าไม่ได้เปลี่ยน)
    res.clearCookie("connect.sid");
    // กลับไปหน้า Login
    res.redirect("/login");
  });
});

export default router;
