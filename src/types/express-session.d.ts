import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      CustomerID: number;
      Name: string;
      PhoneNumber: string;
      Shop: string;
      Table: string;
    };
  }
}

// ขยาย type ของ SessionData เพื่อให้มี isAdmin
declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean; // ใช้เช็คสิทธิ์หลัง login แอดมิน
  }
}
