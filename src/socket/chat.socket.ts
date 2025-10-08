import { Server, Socket } from "socket.io";
import {
  getCurrentShowing,
  getNextQueued,
  markShowing,
  markDone,
} from "../services/warp.service";

/** helper: map row จาก DB → payload สำหรับจอใหญ่ */
function toWarpPayload(row: any) {
  return {
    QueueID: row.QueueID,
    TableID: row.TableID ?? null,
    Message: row.Message ?? "",
    ImageURL: row.ImageURL ?? null,     //  ส่งรูปไปให้ /screen เสมอ (ถ้ามี)
    DurationSec: row.DurationSec ?? 15, // ระยะเวลาที่ฉาย
  };
}

/** ลงทะเบียนอีเวนต์ของ Socket.IO สำหรับแชท/จอใหญ่ */
export function registerChatSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("socket connected:", socket.id);

    // ถ้ามีอีเวนต์อื่นในอนาคต ค่อยเพิ่มที่นี่
    socket.on("disconnect", () => {
      /* no-op */
    });
  });

  // ===== Warp processor (run ทุก ~1s) =====
  const TICK_MS = 1000;

  setInterval(async () => {
    try {
      // 1) ตอนนี้มีตัวที่กำลังแสดงอยู่ไหม?
      const curr = await getCurrentShowing();
      const now = Date.now();

      if (curr) {
        const started = new Date(curr.StartsAt).getTime();
        const endsAt = started + (curr.DurationSec ?? 15) * 1000;

        if (isFinite(started) && now < endsAt) {
          // ยังอยู่ในช่วงเวลาฉาย → broadcast สถานะปัจจุบัน
          io.emit("warp:now", toWarpPayload(curr)); //  ส่ง payload ที่มี ImageURL
          return;
        }

        // หมดเวลาแล้ว → mark done และแจ้งจอให้ล้าง
        await markDone(curr.QueueID);
        io.emit("warp:done", { queueId: curr.QueueID });
      }

      // 2) ถ้าไม่มีตัวกำลังแสดง → ดึงตัวถัดไปจากคิว
      const next = await getNextQueued();
      if (next) {
        // เปลี่ยนสถานะเป็น showing + ตีเวลาเริ่ม
        await markShowing(next.QueueID, next.DurationSec ?? 15);

        // ดึงกลับมาอีกรอบเพื่อความชัวร์ แล้ว broadcast
        const showing = await getCurrentShowing();
        if (showing) {
          io.emit("warp:now", toWarpPayload(showing)); //  ส่งรูป/ข้อความครบ
        }
      }
    } catch (err) {
      console.error("[warp] loop error:", err);
    }
  }, TICK_MS);
}
