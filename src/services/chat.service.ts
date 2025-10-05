import { pool } from "./db";
import { ResultSetHeader } from "mysql2";

/** พารามิเตอร์การสร้าง message ใหม่ */
interface AddMessageInput {
  customerId: number | null;
  tableId: number | null;
  message: string;
}

/** [move-only] เดิมเป็นบรรทัด INSERT ใน routes/chat.ts */
export async function addMessage(input: AddMessageInput): Promise<number> {
  const { customerId, tableId, message } = input;

  // เดิม: "INSERT INTO chat_message (CustomerID, TableID, Message) VALUES (?, ?, ?)"
  const [ins] = await pool.query<ResultSetHeader>(
    "INSERT INTO chat_message (CustomerID, TableID, Message) VALUES (?, ?, ?)",
    [customerId, tableId, message]
  );
  return ins.insertId; // คืน chatId เดิม
}
