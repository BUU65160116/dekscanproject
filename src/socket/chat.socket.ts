import { Server, Socket } from "socket.io";
import {
  getCurrentShowing,
  getNextQueued,
  markShowing,
  markDone,
} from "../services/warp.service";

/** ลงทะเบียนอีเวนต์ของ Socket.IO สำหรับแชท/จอใหญ่ */
export function registerChatSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("socket connected:", socket.id);

    // ถ้าในอนาคตมีอีเวนต์อื่น ๆ (join room, ping, ฯลฯ)
    // ให้ย้ายมาไว้ในบล็อกนี้แบบ 1:1
    socket.on("disconnect", () => {
      // (เดิมไม่มี logic อื่น — คงไว้เป็น no-op)
    });
  });
  
   // ===== Warp processor (run ทุก ~1s) =====
  const TICK_MS = 1000;

  setInterval(async () => {
    try {
      // 1) เช็คว่าตอนนี้มีรายการกำลัง “แสดงอยู่” ไหม
      const curr = await getCurrentShowing();
      const now = Date.now();

      if (curr) {
        const started = new Date(curr.StartsAt).getTime();       // เวลาเริ่มแสดง
        const endsAt  = started + (curr.DurationSec ?? 15) * 1000; // เวลาจบ

        if (isFinite(started) && now < endsAt) {
          // ยังไม่จบ → broadcast สถานะปัจจุบันซ้ำ ๆ กันกรณีฝั่งจอรีเฟรช
          io.emit("warp:now", curr);
          return;
        }

        // จบแล้ว → เปลี่ยนสถานะเป็น done และแจ้งทุกจอ
        await markDone(curr.QueueID);
        io.emit("warp:done", { queueId: curr.QueueID });
      }

      // 2) ถ้าไม่มีตัวกำลังแสดง → ดึงตัวถัดไปจากคิว
      const next = await getNextQueued();
      if (next) {
        // set เป็น showing + ตีเวลาเริ่ม/ระยะเวลา
        await markShowing(next.QueueID, next.DurationSec ?? 15);

        // ดึงสถานะปัจจุบันอีกครั้งเพื่อส่งให้จอ
        const showing = await getCurrentShowing();
        if (showing) io.emit("warp:now", showing);
      }
    } catch (err) {
      // กันลูปตาย — แค่ล็อกไว้
      console.error("[warp] loop error:", err);
    }
  }, TICK_MS);
}

