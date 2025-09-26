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
