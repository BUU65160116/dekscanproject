import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth"; // ✅ import middleware ที่เราสร้างไว้
import { getTotalPoints } from "../services/points"; 
import { pool } from "../services/db";
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
  const points = await getTotalPoints(user.CustomerID); 

  // เช็คอินวันนี้แล้วหรือยัง
  const [todayRows] = await pool.query<any[]>(
    "SELECT 1 FROM points_log WHERE CustomerID = ? AND LogDate = CURDATE() LIMIT 1",
    [user.CustomerID]
  );
  const checkedInToday = todayRows.length > 0;

  res.render("home", {
    shop: SHOP,
    user,
    points,
    checkedInToday,
    table: user.Table || "",
  });
});

//  โครงหน้า “รายละเอียดแต้ม”
router.get("/points", requireAuth, async (req, res) => {
  const user = req.session.user;
  // ไว้ค่อยทำจริง — ตอนนี้แค่ stub
  res.render("points", { user });
});

//  โครงหน้า “แจกวาปขึ้นจอใหญ่”
router.get("/warp", requireAuth, (req, res) => {
  const user = req.session.user;
  // ไว้ค่อยเชื่อม socket/realtime — ตอนนี้แค่ stub
  res.render("warp", { user, shop: SHOP });
});

//  โครงหน้า “แชทเรียลไทม์ (ฝั่งลูกค้า)”
router.get("/chat", requireAuth, (req, res) => {
  const user = req.session.user;
  // ไว้ค่อยต่อ socket.io — ตอนนี้แค่ stub
  res.render("chat", { user });
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
