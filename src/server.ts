import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import { pool } from "./services/db";

import publicRoutes from "./routes/public";  // เส้นทาง /login, /register
import adminRouter from "./routes/admin";    // เส้นทางฝั่งแอดมิน
import screenRouter from "./routes/screen";  // ✅ จอใหญ่ (Big Screen) ที่เพิ่มเข้ามา

dotenv.config();

const app = express();

/* ------------------ Core & Middlewares ------------------ */
// session
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 ชั่วโมง
}));

// body parsers (อย่าให้ซ้ำ)
app.use(express.urlencoded({ extended: true })); // รองรับ <form method="POST">
app.use(express.json());

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// static files (เช่น /public/screen.css)
app.use(express.static(path.join(process.cwd(), "public")));

/* ------------------ Health & Tools ------------------ */
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

/* ------------------ Routes ------------------ */
app.use("/admin", adminRouter);   // ฝั่งแอดมิน
app.use("/screen", screenRouter); // ✅ จอใหญ่ (Big Screen) เปิดที่ /screen
app.use("/", publicRoutes);       // หน้า public (login/register)

/* ------------------ Start Server ------------------ */
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});