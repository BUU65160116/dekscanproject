/** ตรวจเบอร์มือถือไทย: รับเฉพาะตัวเลข 10 หลักขึ้นต้นด้วย 0 (เช่น 08xxxxxxxx) */
export function isValidThaiPhone(input: any): boolean {
  const digits = String(input ?? "").replace(/\D/g, "");
  return /^0\d{9}$/.test(digits);
}

/** แปลงค่าจากฟอร์มให้เป็นเลขโต๊ะ (int) ถ้าไม่ได้ให้เป็น null */
export function toIntTable(v: any): number | null {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}