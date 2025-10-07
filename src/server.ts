import path from "path";
import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// internal
import { registerChatSockets } from "./socket/chat.socket";
import { pool } from "./services/db";
import publicRoutes from "./routes/public";   // /login, /register
import adminRouter from "./routes/admin";     // กลุ่ม /admin ที่เหลือ
import screenRouter from "./routes/screen";   // จอใหญ่
import chatRouter from "./routes/chat";       // แชท
import odooRoutes from "./routes/odoo";       // /admin ที่เกี่ยวกับ Odoo
import unpaidRoutes from "./routes/unpaid";   // /admin/unpaid/*
import warpRoutes from "./routes/warp";

dotenv.config();

// -----------------------------------------------------------------------------
// App & Socket.IO
// -----------------------------------------------------------------------------
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// -----------------------------------------------------------------------------
// Core Middlewares
// -----------------------------------------------------------------------------

// session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 ชั่วโมง
  })
);

// body parsers
app.use(express.urlencoded({ extended: true })); // รองรับ <form method="POST">
app.use(express.json());

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// static files (เช่น /public/screen.css)
app.use(express.static(path.join(process.cwd(), "public")));

// inject io เข้า req (ใช้ any เพื่อลดผลกระทบ type)
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});

// -----------------------------------------------------------------------------
// Health & Tools
// -----------------------------------------------------------------------------
app.get("/health", (_req, res) => res.send("OK"));

app.get("/dbtest", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------
app.use("/admin", odooRoutes);
app.use("/admin", unpaidRoutes);
app.use("/admin", adminRouter);

app.use(warpRoutes);
app.use("/screen", screenRouter);
app.use("/chat", chatRouter);
app.use("/", publicRoutes); // หน้า public (login/register)

// -----------------------------------------------------------------------------
// Socket.IO
// -----------------------------------------------------------------------------
registerChatSockets(io);

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});





// /* ------------------ OTP Helpers & Routes ------------------ */
// // เก็บ OTP ชั่วคราวในหน่วยความจำ (เดโม)
// // โปรดเปลี่ยนไปใช้ Redis/DB ในงานจริง
// const otpStore = new Map<string, { code: string; expires: number }>();

// function generateOTP(len = 6) {
//   // คืนค่าเป็นสตริงตัวเลขความยาว len
//   let s = "";
//   while (s.length < len) s += Math.floor(Math.random() * 10);
//   return s.slice(0, len);
// }

// function setOTP(phone: string, code: string, ttlSec = 300) {
//   otpStore.set(phone, { code, expires: Date.now() + ttlSec * 1000 });
// }

// function verifyOTP(phone: string, code: string) {
//   const item = otpStore.get(phone);
//   if (!item) return false;
//   if (Date.now() > item.expires) return false;
//   return item.code === code;
// }

// // หน้าให้กรอก OTP (รับ ?phone=xxx มาแสดง)
// app.get("/auth/otp", (req, res) => {
//   const phone = (req.query.phone as string) || "";
//   res.render("otp", { phone, error: null, action: "/auth/verify-otp", resendAction: "/auth/resend-otp" });
// });

// // กด “ยืนยัน” OTP
// app.post("/auth/verify-otp", (req, res) => {
//   const { otp, phone } = req.body as { otp?: string; phone?: string };

//   if (!phone) {
//     return res.status(400).render("otp", { phone: "", error: "ไม่พบเบอร์โทร", action: "/auth/verify-otp", resendAction: "/auth/resend-otp" });
//   }
//   if (!otp || otp.length !== 6) {
//     return res.status(400).render("otp", { phone, error: "กรุณากรอกรหัสให้ครบ 6 หลัก", action: "/auth/verify-otp", resendAction: "/auth/resend-otp" });
//   }

//   if (!verifyOTP(phone, otp)) {
//     return res.status(401).render("otp", { phone, error: "รหัสไม่ถูกต้อง หรือหมดอายุ", action: "/auth/verify-otp", resendAction: "/auth/resend-otp" });
//   }

//   // ✅ ผ่านแล้ว: ใส่อะไรก็ได้ เช่น mark ว่า verified
//   (req.session as any).otpVerified = true;
//   (req.session as any).phone = phone;

//   // ล้าง OTP ที่ใช้แล้ว (ไม่บังคับ แต่แนะนำ)
//   otpStore.delete(phone);

//   // ไปหน้าไหนต่อก็ได้ เช่น /dashboard
//   return res.redirect("/dashboard");
// });

// // ปุ่ม “ส่งรหัสใหม่”
// app.post("/auth/resend-otp", (req, res) => {
//   const { phone } = req.body as { phone?: string };

//   if (!phone) return res.status(400).json({ ok: false, message: "ไม่พบเบอร์โทร" });

//   const code = generateOTP(6);
//   setOTP(phone, code, 300); // อายุ 5 นาที

//   // TODO: ส่ง SMS จริง (เช่น Firebase/บริการ SMS)
//   console.log(`[DEV] ส่ง OTP ให้ ${phone}: ${code}`);

//   return res.json({ ok: true });
// });
