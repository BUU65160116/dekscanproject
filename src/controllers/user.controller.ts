import { Request, Response } from "express";
import { ensurePointsRow, awardCheckinIfFirstToday } from "../services/points"; //  บริการแต้ม (คงเดิม)
import * as userService from "../services/user.service";                         //  แทน pool.query
import { isValidThaiPhone, toIntTable } from "../utils/validators";              //  helper ที่ย้ายมา

const SHOP = process.env.SHOP_CODE || "MYBAR";

// -------------------- VIEWS --------------------

/** GET /login */
export const showLogin = (req: Request, res: Response) => {
  const shop = SHOP;
  const table = String(req.query.table || "");
  res.render("login", { shop, table, msg: null, error: null });
};

/** GET /register */
export const showRegister = (req: Request, res: Response) => {
  const shop = SHOP;
  const table = String(req.query.table || "");
  res.render("register", { shop, table, msg: null, error: null });
};

// -------------------- ACTIONS --------------------

/** POST /login */
export const submitLogin = async (req: Request, res: Response) => {
  const shopCode = SHOP;
  const { tableNumber, phone } = req.body as {
    shopCode?: string; tableNumber?: string; phone?: string;
  };

  if (!tableNumber || !phone) {
    return res.render("login", { shop: shopCode, table: tableNumber || "", msg: null, error: "กรอกข้อมูลให้ครบ" });
  }
  if (!isValidThaiPhone(phone)) {
    return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "รูปแบบเบอร์ไม่ถูกต้อง (10 หลัก)" });
  }

  try {
    // เดิม: const [rows] = await pool.query<any[]>(...)
    const rows = await userService.query<any>(
      "SELECT CustomerID, Name, PhoneNumber FROM customer WHERE PhoneNumber = ?",
      [String(phone).trim()]
    );
    if (rows.length === 0) {
      return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "ไม่พบบัญชีนี้ โปรดสมัครก่อน" });
    }

    // เก็บตัวตน + บริบทโต๊ะ/ร้านลง session (คงเดิม)
    req.session.user = {
      CustomerID: rows[0].CustomerID,
      Name: rows[0].Name,
      PhoneNumber: rows[0].PhoneNumber,
      Shop: shopCode,
      Table: String(tableNumber),
    };

    // shorthand สำหรับแชท/จอใหญ่ (คงเดิม)
    req.session.customerId = rows[0].CustomerID;
    const tableId = toIntTable(tableNumber);
    req.session.tableId = tableId;

    // บันทึก scanlog (คงเดิม: จับ error code)
    if (tableId !== null) {
      try {
        await userService.exec(
          "INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)",
          [rows[0].CustomerID, tableId]
        );
      } catch (err: any) {
        if (err?.code === "ER_NO_REFERENCED_ROW_2") {
          return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "ไม่พบโต๊ะนี้ในระบบ กรุณาเเสกนQRที่โต๊ะของคุณ" });
        }
        throw err;
      }
    }

    // แต้ม: สร้าง row ถ้ายังไม่มี + ให้แต้มครั้งแรกของวัน (คงเดิม)
    await ensurePointsRow(rows[0].CustomerID);
    await awardCheckinIfFirstToday(rows[0].CustomerID, tableId);

    // ไปหน้า home
    return res.redirect("/home");
  } catch (e) {
    console.error("submitLogin error:", e);
    return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" });
  }
};

/** POST /register */
export const submitRegister = async (req: Request, res: Response) => {
  const shopCode = SHOP; // ร้านเดียว
  const { tableNumber, name, phone } = req.body as {
    shopCode?: string; tableNumber?: string; name?: string; phone?: string;
  };

  if (!tableNumber || !name || !phone) {
    return res.render("register", { shop: shopCode, table: tableNumber || "", msg: null, error: "กรอกข้อมูลให้ครบ" });
  }
  if (!isValidThaiPhone(phone)) {
    return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "รูปแบบเบอร์ไม่ถูกต้อง (10 หลัก)" });
  }

  try {
    // กันเบอร์ซ้ำ
    const dups = await userService.query<any>(
      "SELECT CustomerID FROM customer WHERE PhoneNumber = ?",
      [String(phone).trim()]
    );
    if (dups.length > 0) {
      return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "เบอร์นี้มีการสมัครแล้ว กรุณาใช้เบอร์อื่น" });
    }

    // สมัครใหม่ (เดิม: const [ins]: any = await pool.query(...))
    const ins = await userService.exec(
      "INSERT INTO customer (Name, PhoneNumber) VALUES (?, ?)",
      [String(name).trim(), String(phone).trim()]
    );
    const newId = ins.insertId;

    // อ่านกลับเพื่อเก็บ session
    const newRows = await userService.query<any>(
      "SELECT CustomerID, Name, PhoneNumber FROM customer WHERE CustomerID = ?",
      [newId]
    );
    if (newRows.length === 0) {
      return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "สมัครสำเร็จ แต่ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่" });
    }

    // เก็บ session (คงเดิม)
    req.session.user = {
      CustomerID: newRows[0].CustomerID,
      Name: newRows[0].Name,
      PhoneNumber: newRows[0].PhoneNumber,
      Shop: shopCode,
      Table: String(tableNumber),
    };

    // shorthand สำหรับแชท/จอใหญ่ (คงเดิม)
    req.session.customerId = newRows[0].CustomerID;
    const tableId = toIntTable(tableNumber);
    req.session.tableId = tableId;

    // บันทึก scanlog
    if (tableId !== null) {
      try {
        await userService.exec(
          "INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)",
          [newId, tableId]
        );
      } catch (err: any) {
        if (err?.code === "ER_NO_REFERENCED_ROW_2") {
          return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "ไม่พบโต๊ะนี้ในระบบ กรุณาเพิ่มใน tableqr ก่อน" });
        }
        if (err?.code === "ER_DUP_ENTRY") {
          return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "เบอร์นี้ถูกใช้แล้ว กรุณาใช้เบอร์อื่น" });
        }
        throw err;
      }
    }

    // แต้ม (คงเดิม)
    await ensurePointsRow(newRows[0].CustomerID);
    await awardCheckinIfFirstToday(newRows[0].CustomerID, tableId);

    // ไปหน้า home
    return res.redirect("/home");
  } catch (e) {
    console.error("submitRegister error:", e);
    return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" });
  }
}