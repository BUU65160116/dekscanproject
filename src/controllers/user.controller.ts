import { Request, Response } from "express";
import { pool } from "../services/db";

/** เบอร์ไทย 10 หลัก 0-9 */
const isValidThaiPhone = (p: string) => /^[0-9]{10}$/.test((p || "").trim());

/** แปลงเลขโต๊ะจากข้อความ -> number (เช่น "5" -> 5) ถ้าไม่ใช่เลข => null */
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

  // ตรวจความครบถ้วน
  if (!shopCode || !tableNumber || !phone) {
    return res.render("login", {
      shop: shopCode || "",
      table: tableNumber || "",
      msg: null,
      error: "กรอกข้อมูลให้ครบ",
    });
  }

  // ตรวจรูปแบบเบอร์
  if (!isValidThaiPhone(phone)) {
    return res.render("login", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "รูปแบบเบอร์ไม่ถูกต้อง (ต้องมี 10 หลัก)",
    });
  }

  try {
    const [rows] = await pool.query<any[]>(
      "SELECT CustomerID, Name FROM customer WHERE PhoneNumber = ?",
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

    // บันทึกลง scanlog (ต้องมีแถวของโต๊ะใน tableqr ก่อนเพื่อให้ FK ไม่พัง)
    const tableId = toIntTable(tableNumber);
    if (tableId !== null) {
      try {
        await pool.query(
          "INSERT INTO scanlog (CustomerID, TableID) VALUES (?, ?)",
          [rows[0].CustomerID, tableId]
        );
      } catch (err: any) {
        // จับ FK error ให้แสดงข้อความเข้าใจง่าย
        if (err?.code === "ER_NO_REFERENCED_ROW_2") {
          return res.render("login", {
            shop: shopCode,
            table: tableNumber,
            msg: null,
            error:
              "ไม่พบโต๊ะนี้ในระบบ (TableID ไม่ตรงกับ tableqr) กรุณาเพิ่มโต๊ะใน tableqr ก่อน",
          });
        }
        throw err;
      }
    }

    return res.render("login", {
      shop: shopCode,
      table: tableNumber,
      msg: `เช็คอินสำเร็จ: สวัสดีคุณ ${rows[0].Name}`,
      error: null,
    });
  } catch (e) {
    console.error(e);
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

  // ตรวจความครบถ้วน
  if (!shopCode || !tableNumber || !name || !phone) {
    return res.render("register", {
      shop: shopCode || "",
      table: tableNumber || "",
      msg: null,
      error: "กรอกข้อมูลให้ครบ",
    });
  }

  // ตรวจรูปแบบเบอร์
  if (!isValidThaiPhone(phone)) {
    return res.render("register", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "รูปแบบเบอร์ไม่ถูกต้อง (ต้องมี 10 หลัก)",
    });
  }

  try {
    // กันเบอร์ซ้ำ
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

    // สมัครใหม่
    const [ins]: any = await pool.query(
      "INSERT INTO customer (Name, PhoneNumber) VALUES (?, ?)",
      [name.trim(), phone.trim()]
    );
    const newId = ins.insertId;

    // บันทึกลง scanlog
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
        // กันชน UNIQUE ที่เบอร์ในกรณีแข่งกันกด
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

    return res.render("register", {
      shop: shopCode,
      table: tableNumber,
      msg: "สมัครสำเร็จ! ตอนนี้คุณสามารถล็อกอินได้เลย",
      error: null,
    });
  } catch (e) {
    console.error(e);
    return res.render("register", {
      shop: shopCode,
      table: tableNumber,
      msg: null,
      error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์",
    });
  }
};
