// src/types/session.d.ts
import "express-session";
import type { Server as SocketIOServer } from "socket.io";

declare module "express-session" {
  interface SessionData {
    // โปรไฟล์ผู้ใช้ที่คุณมีอยู่เดิม
    user?: {
      CustomerID: number;
      Name: string;
      PhoneNumber: string;
      Shop: string;
      Table: string;
    };

    // สิทธิ์แอดมิน
    isAdmin?: boolean;

    // สำหรับ flow แชท/จอใหญ่
    customerId?: number;
    tableId?: number | null;
  }
}

declare global {
  namespace Express {
    interface Request {
      io?: SocketIOServer; // ให้ req.io พิมพ์ชัดเจน
    }
  }
}

export {};
