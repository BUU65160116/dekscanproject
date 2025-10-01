import { Request, Response } from "express";
import { pool } from "../services/db";
import { ensurePointsRow, awardCheckinIfFirstToday } from "../services/points"; // เพิ่มใช้บริการแต้ม

const SHOP = process.env.SHOP_CODE || "MYBAR";

/** ✅ ตรวจเบอร์ไทย 10 หลัก */
const isValidThaiPhone = (p: string) => /^[0-9]{10}$/.test((p || "").trim());

/** ✅ แปลงเลขโต๊ะเป็น number; ไม่ใช่เลขหรือ <=0 ให้คืน null */
const toIntTable = (x: string) => {
  const n = Number((x || "").toString().trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
    const [rows] = await pool.query<any[]>(
      "SELECT CustomerID, Name, PhoneNumber FROM customer WHERE PhoneNumber = ?",
      [phone.trim()]
    );
    if (rows.length === 0) {
      return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "ไม่พบบัญชีนี้ โปรดสมัครก่อน" });
    }

    // 4) เก็บตัวตน + บริบทโต๊ะ/ร้านลง session
    req.session.user = {
      CustomerID: rows[0].CustomerID,
      Name: rows[0].Name,
      PhoneNumber: rows[0].PhoneNumber,
      Shop: shopCode,
      Table: String(tableNumber),
    };

    //  ค่า shorthand สำหรับฟีเจอร์แชท/จอใหญ่ (ฝั่ง POST /chat จะอ่านจากนี่)
    req.session.customerId = rows[0].CustomerID;   // id ผู้ใช้ที่ล็อกอิน
    const tableId = toIntTable(tableNumber);       // แปลงหมายเลขโต๊ะเป็น number (ไม่ใช่เลขให้เป็น null)
    req.session.tableId = tableId;                 // เก็บโต๊ะลง session เพื่อให้ /chat ใช้งานได้อัตโนมัติ
  
    // 5) บันทึกลง scanlog (ถ้า TableID เป็นตัวเลขและมีอยู่จริง)
    if (tableId !== null) {
      try {
        await pool.query("INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)", [rows[0].CustomerID, tableId]);
      } catch (err: any) {
        if (err?.code === "ER_NO_REFERENCED_ROW_2") {
          return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "ไม่พบโต๊ะนี้ในระบบ กรุณาเพิ่มใน tableqr ก่อน" });
        }
        throw err;
      }
    }

    
    //  แต้ม: สร้าง row ถ้ายังไม่มี + ให้แต้มครั้งแรกของวัน (ร้านเดียว)
    await ensurePointsRow(rows[0].CustomerID);
    await awardCheckinIfFirstToday(rows[0].CustomerID, tableId);

    // 6) ไปหน้า home (ใช้ข้อมูลใน session ไม่ต้องพ่วง query)
    return res.redirect("/home");
  } catch (e) {
    console.error("submitLogin error:", e);
    return res.render("login", { shop: shopCode, table: tableNumber, msg: null, error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" });
  }
};

/** POST /register */
export const submitRegister = async (req: Request, res: Response) => {
  const shopCode = SHOP; //  ร้านเดียว
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
    const [dups] = await pool.query<any[]>("SELECT CustomerID FROM customer WHERE PhoneNumber = ?", [phone.trim()]);
    if (dups.length > 0) {
      return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "เบอร์นี้มีการสมัครแล้ว กรุณาใช้เบอร์อื่น" });
    }

    // สมัครใหม่
    const [ins]: any = await pool.query("INSERT INTO customer (Name, PhoneNumber) VALUES (?, ?)", [name.trim(), phone.trim()]);
    const newId = ins.insertId;

    // อ่านกลับเพื่อเก็บ session
    const [newRows] = await pool.query<any[]>("SELECT CustomerID, Name, PhoneNumber FROM customer WHERE CustomerID = ?", [newId]);
    if (newRows.length === 0) {
      return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "สมัครสำเร็จ แต่ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่" });
    }

    // 6) เก็บ session
    req.session.user = {
      CustomerID: newRows[0].CustomerID,
      Name: newRows[0].Name,
      PhoneNumber: newRows[0].PhoneNumber,
      Shop: shopCode,
      Table: String(tableNumber),
    };

    //  ค่า shorthand สำหรับแชท/จอใหญ่
    req.session.customerId = newRows[0].CustomerID;  // ใช้ใน POST /chat
    const tableId = toIntTable(tableNumber);         // number หรือ null
    req.session.tableId = tableId;                   // เก็บโต๊ะไว้ใน session

    // 7 บันทึก scanlog
    if (tableId !== null) {
      try {
        await pool.query("INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)", [newId, tableId]);
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


     // แต้ม
    await ensurePointsRow(newRows[0].CustomerID);
    await awardCheckinIfFirstToday(newRows[0].CustomerID, tableId);

    // 8) ไปหน้า home
    return res.redirect("/home");
  } catch (e) {
    console.error("submitRegister error:", e);
    return res.render("register", { shop: shopCode, table: tableNumber, msg: null, error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" });
  }
};
