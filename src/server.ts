import path from "path";
import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";


import { recalcAllTablesFromOdoo } from "./services/warp.service";

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

// ⬇ เพิ่ม limit ให้รองรับ dataURL base64 ของรูป (ย่อแล้ว) ได้สบาย
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 ชั่วโมง
  })
);

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

// ⬇ ตัวดัก error ของ body-parser ให้ตอบเป็น JSON (กัน parse พัง/ไฟล์ใหญ่)
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ ok: false, error: "payload-too-large" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ ok: false, error: "bad-json" });
  }
  next(err);
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
