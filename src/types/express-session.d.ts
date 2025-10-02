// src/types/express-session.d.ts
import "express-session";
import type { Server as SocketIOServer } from "socket.io";

/** ขยายข้อมูลใน session */
declare module "express-session" {
  interface SessionData {
    user?: {
      CustomerID: number;
      Name: string;
      PhoneNumber: string;
      Shop: string;
      Table: string;
    };
    /** สิทธิ์แอดมิน */
    isAdmin?: boolean;

    /** ค่าช่วยฝั่งลูกค้า/จอใหญ่ */
    customerId?: number;
    tableId?: number | null;
  }
}

/** ขยาย Request ให้มี req.io ใช้งานได้ทุกที่ */
declare global {
  namespace Express {
    interface Request {
      io?: SocketIOServer;
    }
  }
}

/** ทำไฟล์นี้ให้เป็นโมดูล (จำเป็นสำหรับ declare global) */
export {};
