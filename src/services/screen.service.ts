import { pool } from "./db";

export async function fetchHistory(): Promise<any[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT 
       ChatID as chatId,
       TableID as tableId,
       Message as message,
       CreatedAt as createdAt
     FROM chat_message
     WHERE IsDeleted = 0
     ORDER BY ChatID DESC
     LIMIT 50`
  );
  return rows;
}