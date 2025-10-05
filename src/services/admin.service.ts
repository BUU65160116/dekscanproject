import { pool } from "./db";

export async function fetchChatRows(): Promise<any[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT
       ChatID     AS chatId,
       CustomerID AS customerId,
       TableID    AS tableId,
       Message    AS message,
       CreatedAt  AS createdAt
     FROM chat_message
     WHERE IsDeleted = 0
     ORDER BY ChatID DESC
     LIMIT 100`
  );
  return rows;
}

export async function softDeleteMessage(chatId: number): Promise<void> {
  await pool.query("UPDATE chat_message SET IsDeleted = 1 WHERE ChatID = ?", [chatId]);
}

export async function softClearAll(): Promise<void> {
  await pool.query("UPDATE chat_message SET IsDeleted = 1 WHERE IsDeleted = 0");
}