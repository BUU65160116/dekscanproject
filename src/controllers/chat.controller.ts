import { Request, Response } from "express";
import * as chatService from "../services/chat.service";

/** [move-only] เดิม: chatRouter.get("/", requireAuth, (req, res) => {...}) */
export function renderChatPage(req: Request, res: Response) {
  // คงค่าที่ส่งให้ view ให้เหมือนเดิม
  res.render("chat", {
    title: "ส่งข้อความขึ้นจอ",
    tableId: (req as any).session.tableId ?? null,
    customerId: (req as any).session.customerId ?? null,
  });
}

/** [move-only] เดิม: chatRouter.post("/", requireAuth, async (req, res) => {...}) */
export async function createMessage(req: any, res: Response) {
  try {
    const message = (req.body?.message ?? "").toString().trim();
    if (!message) return res.status(400).send("กรุณากรอกข้อความ");

    // คงกติกาเลือก customerId/tableId เหมือนเดิม
    const customerId =
      typeof req.session.customerId === "number"
        ? req.session.customerId
        : (isNaN(Number(req.body?.customerId)) ? null : Number(req.body?.customerId));

    const tableId =
      typeof req.session.tableId === "number"
        ? req.session.tableId
        : (isNaN(Number(req.body?.tableId)) ? null : Number(req.body?.tableId));

    // [move-only] ย้ายบรรทัด INSERT เข้า service (logic DB เดิมเป๊ะ)
    const chatId = await chatService.addMessage({
      customerId,
      tableId,
      message,
    });

    // [unchanged] broadcast ไปจอใหญ่/หน้าแอดมิน ตามเดิม
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
}