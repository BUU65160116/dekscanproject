import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import { pool } from "./services/db";
import publicRoutes from "./routes/public"; // <-- ใช้เส้นทาง /login, /register
import adminRouter from "./routes/admin";

dotenv.config();

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 ชั่วโมง
}));

//  ตรวจสอบว่ามี body parser สำหรับฟอร์มแล้วหรือยัง
app.use(express.urlencoded({ extended: true })); // ต้องมี เพื่อรับค่าจาก <form method="POST">

//  หลังจากที่ตั้งค่า session และ middleware อื่น ๆ เสร็จแล้ว ให้ mount router แอดมิน
app.use("/admin", adminRouter);



// middlewares พื้นฐาน
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ตั้งค่า view engine (เตรียมไว้สำหรับหน้าล็อกอิน/สมัคร)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// เสิร์ฟไฟล์ static เช่น /public/css.css
app.use(express.static(path.join(process.cwd(), "public")));

// เส้นทางทดสอบว่าเซิร์ฟเวอร์วิ่ง
app.get("/health", (_req, res) => res.send("OK"));

// ทดสอบเชื่อม DB
app.get("/dbtest", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

//  ผูกเส้นทางหลัก (ต้องมาก่อน listen)
app.use("/", publicRoutes); // <-- เพิ่มบรรทัดนี้

// เริ่มเซิร์ฟเวอร์
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
