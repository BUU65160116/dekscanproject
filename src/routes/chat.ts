import { Router } from "express";
import { pool } from "../services/db";
import { requireAuth } from "../middlewares/auth"; // 
import { ResultSetHeader } from "mysql2"; 

const chatRouter = Router();

// GET /chat — ต้องล็อกอินก่อน
chatRouter.get("/", requireAuth, (req, res) => {
  res.render("chat", {
    title: "ส่งข้อความขึ้นจอ",
    tableId: req.session.tableId ?? null,
    customerId: req.session.customerId ?? null,
  });
});

// POST /chat — ต้องล็อกอินก่อน
chatRouter.post("/", requireAuth, async (req: any, res) => {
  try {
    const message = (req.body?.message ?? "").toString().trim();
    if (!message) return res.status(400).send("กรุณากรอกข้อความ");

    const customerId =
      typeof req.session.customerId === "number"
        ? req.session.customerId
        : (isNaN(Number(req.body?.customerId)) ? null : Number(req.body?.customerId));

    const tableId =
      typeof req.session.tableId === "number"
        ? req.session.tableId
        : (isNaN(Number(req.body?.tableId)) ? null : Number(req.body?.tableId));

    //  INSERT + เอา insertId เพื่อนำไป emit
    const [ins] = await pool.query<ResultSetHeader>(
      "INSERT INTO chat_message (CustomerID, TableID, Message) VALUES (?, ?, ?)",
      [customerId, tableId, message]
    );
    const chatId = ins.insertId;

    //  broadcast ไปจอใหญ่/หน้าแอดมิน พร้อม chatId
    req.io.emit("newMessage", {
      chatId,
      tableId,
      message,
      createdAt: new Date().toISOString(),
    });

    return res.redirect("/chat");
  } catch (e) {
    console.error(e);
    return res.status(500).send("เกิดข้อผิดพลาดในการบันทึกข้อความ");
  }
});

export default chatRouter;
