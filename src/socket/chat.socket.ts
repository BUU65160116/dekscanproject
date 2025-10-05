import { Server, Socket } from "socket.io";

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
}
