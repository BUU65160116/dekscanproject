import { pool } from "./db";  // ใช้ pool เดิม

export type ManualDebt = {
  DebtID: number;
  TableID: number | null;
  CustomerName: string;
  Phone: string;
  Amount: number;
  Note: string | null;
  Status: "open" | "resolved";
  CreatedAt: string;
};

// เพิ่มค้างชำระ (เดี่ยว)
export async function createManualDebt(data: {
  TableID: number | null;
  CustomerName: string;
  Phone: string;
  Amount: number;
  Note?: string;
}) {
  const sql = `
    INSERT INTO manual_debt (TableID, CustomerName, Phone, Amount, Note, Status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `;
  const [result]: any = await pool.query(sql, [
    data.TableID,
    data.CustomerName,
    data.Phone,
    data.Amount,
    data.Note || null,
  ]);
  return result.insertId;
}

// ดึงรายการค้างชำระ (เฉพาะที่เปิดอยู่)
export async function listOpenManualDebt(limit = 100): Promise<ManualDebt[]> {
  const sql = `
    SELECT DebtID, TableID, CustomerName, Phone, Amount, Note, Status, CreatedAt
    FROM manual_debt
    WHERE Status = 'open'
    ORDER BY CreatedAt DESC
    LIMIT ?
  `;
  const [rows]: any = await pool.query(sql, [limit]);
  return rows;
}

// แก้ไขข้อมูล / ปิดงาน
export async function updateManualDebt(data: {
  DebtID: number;
  CustomerName: string;
  Phone: string;
  Amount: number;
  Note?: string;
  Status: "open" | "resolved";
}) {
  const sql = `
    UPDATE manual_debt
    SET CustomerName=?, Phone=?, Amount=?, Note=?, Status=?
    WHERE DebtID=?
  `;
  await pool.query(sql, [
    data.CustomerName,
    data.Phone,
    data.Amount,
    data.Note || null,
    data.Status,
    data.DebtID,
  ]);
  return true;
}

//   บันทึกหลายคนในโต๊ะ ครั้งเดียว
export async function bulkCreateManualDebt(data: {
  TableID: number | null;
  Amount: number;
  Note?: string | null;
  People: { CustomerName: string; Phone: string }[];
}) {
  if (!data.People?.length) return 0;

  // สร้าง INSERT หลายค่าในคำสั่งเดียว
  const placeholders = data.People.map(() => "(?, ?, ?, ?, ?, 'open')").join(",");
  const sql = `
    INSERT INTO manual_debt (TableID, CustomerName, Phone, Amount, Note, Status)
    VALUES ${placeholders}
  `;

  const params: any[] = [];
  for (const p of data.People) {
    params.push(
      data.TableID,
      p.CustomerName,
      p.Phone,
      data.Amount,
      data.Note ?? null
    );
  }

  const [result]: any = await pool.query(sql, params);
  return result.affectedRows as number;
}
