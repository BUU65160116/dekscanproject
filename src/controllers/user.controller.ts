import { Request, Response } from "express";
import { pool } from "../services/db";

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
  const shop = String(req.query.shop || "");
  const table = String(req.query.table || "");
  res.render("login", { shop, table, msg: null, error: null });
};

/** GET /register */
export const showRegister = (req: Request, res: Response) => {
  const shop = String(req.query.shop || "");
  const table = String(req.query.table || "");
  res.render("register", { shop, table, msg: null, error: null });
};

// -------------------- ACTIONS --------------------

/** POST /login */
export const submitLogin = async (req: Request, res: Response) => {
  const { shopCode, tableNumber, phone } = req.body as {
    shopCode?: string; tableNumber?: string; phone?: string;
  };

  // 1) ตรวจความครบถ้วน
  if (!shopCode || !tableNumber || !phone) {
    return res.render("login", {
      shop: shopCode || "",
      table: tableNumber || "",
      msg: null,
      error: "กรอกข้อมูลให้ครบ",
    });
  }

  // 2) ตรวจรูปแบบเบอร์
  if (!isValidThaiPhone(phone)) {
    return res.render("login", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "รูปแบบเบอร์ไม่ถูกต้อง (ต้องมี 10 หลัก)",
    });
  }

  try {
    // 3) หา customer จากเบอร์
    const [rows] = await pool.query<any[]>(
      "SELECT CustomerID, Name, PhoneNumber FROM customer WHERE PhoneNumber = ?",
      [phone.trim()]
    );
    if (rows.length === 0) {
      return res.render("login", {
        shop: shopCode,
        table: tableNumber,
        msg: null,
        error: "ไม่พบบัญชีนี้ โปรดสมัครก่อน",
      });
    }

    // 4) เก็บตัวตน + บริบทโต๊ะ/ร้านลง session
    req.session.user = {
      CustomerID: rows[0].CustomerID,
      Name: rows[0].Name,
      PhoneNumber: rows[0].PhoneNumber,
      Shop: String(shopCode),
      Table: String(tableNumber),
    };

    // 5) บันทึกลง scanlog (ถ้า TableID เป็นตัวเลขและมีอยู่จริง)
    const tableId = toIntTable(tableNumber);
    if (tableId !== null) {
      try {
        await pool.query(
          "INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)",
          [rows[0].CustomerID, tableId]
        );
      } catch (err: any) {
        // จับ FK error -> แจ้งให้เพิ่มโต๊ะใน tableqr ก่อน
        if (err?.code === "ER_NO_REFERENCED_ROW_2") {
          return res.render("login", {
            shop: shopCode,
            table: tableNumber,
            msg: null,
            error:
              "ไม่พบโต๊ะนี้ในระบบ (TableID ไม่ตรงกับ tableqr) กรุณาเพิ่มโต๊ะใน tableqr ก่อน",
          });
        }
        // ข้อผิดพลาดอื่นให้โยนไปให้ catch ด้านล่างจัดการ
        throw err;
      }
    }

    // 6) ไปหน้า home (ใช้ข้อมูลใน session ไม่ต้องพ่วง query)
    return res.redirect("/home");
  } catch (e) {
    console.error("submitLogin error:", e);
    return res.render("login", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์",
    });
  }
};

/** POST /register */
export const submitRegister = async (req: Request, res: Response) => {
  const { shopCode, tableNumber, name, phone } = req.body as {
    shopCode?: string; tableNumber?: string; name?: string; phone?: string;
  };

  // 1) ตรวจความครบถ้วน
  if (!shopCode || !tableNumber || !name || !phone) {
    return res.render("register", {
      shop: shopCode || "",
      table: tableNumber || "",
      msg: null,
      error: "กรอกข้อมูลให้ครบ",
    });
  }

  // 2) ตรวจรูปแบบเบอร์
  if (!isValidThaiPhone(phone)) {
    return res.render("register", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "รูปแบบเบอร์ไม่ถูกต้อง (ต้องมี 10 หลัก)",
    });
  }

  try {
    // 3) กันเบอร์ซ้ำ
    const [dups] = await pool.query<any[]>(
      "SELECT CustomerID FROM customer WHERE PhoneNumber = ?",
      [phone.trim()]
    );
    if (dups.length > 0) {
      return res.render("register", {
        shop: shopCode,
        table: tableNumber,
        msg: null,
        error: "เบอร์นี้มีการสมัครแล้ว กรุณาใช้เบอร์อื่น",
      });
    }

    // 4) สมัครใหม่
    const [ins]: any = await pool.query(
      "INSERT INTO customer (Name, PhoneNumber) VALUES (?, ?)",
      [name.trim(), phone.trim()]
    );
    const newId = ins.insertId;

    // 5) อ่านข้อมูลลูกค้าที่เพิ่งสมัคร (เพื่อเก็บใน session)
    const [newRows] = await pool.query<any[]>(
      "SELECT CustomerID, Name, PhoneNumber FROM customer WHERE CustomerID = ?",
      [newId]
    );
    if (newRows.length === 0) {
      return res.render("register", {
        shop: shopCode,
        table: tableNumber,
        msg: null,
        error: "สมัครสำเร็จ แต่ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่",
      });
    }

    // 6) เก็บ session
    req.session.user = {
      CustomerID: newRows[0].CustomerID,
      Name: newRows[0].Name,
      PhoneNumber: newRows[0].PhoneNumber,
      Shop: String(shopCode),
      Table: String(tableNumber),
    };

    // 7) บันทึกลง scanlog
    const tableId = toIntTable(tableNumber);
    if (tableId !== null) {
      try {
        await pool.query(
          "INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)",
          [newId, tableId]
        );
      } catch (err: any) {
        if (err?.code === "ER_NO_REFERENCED_ROW_2") {
          return res.render("register", {
            shop: shopCode,
            table: tableNumber,
            msg: null,
            error:
              "ไม่พบโต๊ะนี้ในระบบ (TableID ไม่ตรงกับ tableqr) กรุณาเพิ่มโต๊ะใน tableqr ก่อน",
          });
        }
        if (err?.code === "ER_DUP_ENTRY") {
          return res.render("register", {
            shop: shopCode,
            table: tableNumber,
            msg: null,
            error: "เบอร์นี้ถูกใช้แล้ว กรุณาใช้เบอร์อื่น",
          });
        }
        throw err;
      }
    }

    // 8) ไปหน้า home
    return res.redirect("/home");
  } catch (e) {
    console.error("submitRegister error:", e);
    return res.render("register", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์",
    });
  }
};
