import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import { pool } from "./services/db";

import publicRoutes from "./routes/public";  // เส้นทาง /login, /register
import adminRouter from "./routes/admin";    // เส้นทางฝั่งแอดมิน
import screenRouter from "./routes/screen";  // จอใหญ่ (Big Screen)
import chatRouter from "./routes/chat";

//  เพิ่มเติมสำหรับ Socket.IO
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

dotenv.config();

const app = express();


//  ห่อด้วย http server เพื่อใช้กับ socket.io
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

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

//  inject io เข้าไปใน req สำหรับใช้งานใน routes อื่น (ชั่วคราวแคสเป็น any)
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});


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
app.use("/screen", screenRouter); // จอใหญ่ (Big Screen) เปิดที่ /screen
app.use("/chat", chatRouter); 
app.use("/", publicRoutes);       // หน้า public (login/register)


/* ------------------ Socket.IO ------------------ */
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
});

/* ------------------ Start Server ------------------ */
const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});