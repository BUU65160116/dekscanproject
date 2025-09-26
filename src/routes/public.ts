import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth"; // ✅ import middleware ที่เราสร้างไว้

const router = Router();

// เมื่อลูกค้าสแกน จะเข้าหน้า Login ก่อนเสมอ
router.get("/login", showLogin);
router.post("/login", submitLogin);

// แสดงหน้า Register 
router.get("/register", showRegister);
router.post("/register", submitRegister);

// ✅ หน้า home: อ่าน shop/table จาก session แทน query
router.get("/home", requireAuth, (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  // ดึงค่า shop/table จาก session ที่เราเก็บไว้ตอน login/register
  const shop = user.Shop || "";
  const table = user.Table || "";

  return res.render("home", { user, shop, table });
});

// ✅ ออกจากระบบ
router.get("/logout", (req, res) => {
  req.session?.destroy(() => {
    res.redirect("/login");
  });
});

export default router;
