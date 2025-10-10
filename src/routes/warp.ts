import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  getCreditsForToday,
  consumeOneCredit,
  recalcAndGetLeft, // ⭐ เพิ่ม: สำหรับเช็คสิทธิ์แบบรีคาลก์ทันที
} from "../services/warp.service";

const router = Router();

// ====== Validation / Anti-Spam config & helpers ======
const MAX_MSG_LEN = 300;
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5 MB
const TABLE_COOLDOWN_MS = 10_000;  // 10 วิ/โต๊ะ

// in-memory throttle: tableId -> lastUsedAt
const TABLE_LAST_USE = new Map<number, number>();

// คำต้องห้ามเบื้องต้น (ปรับได้)
const BAD_WORDS = ["เหี้ย","สัส","ควย","fuck","shit"];

function normalizeMessage(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
function hasBadWord(s: string) {
  const lower = s.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}
function validDataImage(dataUrl?: string | null) {
  if (!dataUrl) return { ok: true, reason: "no-image" };
  if (!dataUrl.startsWith("data:image/")) return { ok: false, reason: "not-image-dataurl" };
  const bytes = Math.floor((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 3 / 4);
  if (bytes > MAX_IMAGE_BYTES) return { ok: false, reason: "image-too-large" };
  return { ok: true, reason: "ok" };
}

/** หน้า UI ลูกค้า */
router.get("/warp", requireAuth, async (_req, res) => {
  res.render("warp", { title: "แจกวาป" });
});

/**
 * GET /warp/credits
 * - ต้องล็อกอิน
 * - ใช้ tableId จาก session เท่านั้น
 * - ถ้ามี query ?recalc=1 → จะรีคาลก์จาก Odoo ก่อนแล้วค่อยคืนค่า (⭐ ของใหม่)
 */
router.get("/warp/credits", requireAuth, async (req, res) => {
  try {
    const tableId = req.session.tableId as number | undefined;
    if (!tableId) return res.status(400).json({ ok: false, error: "no-table-in-session" });

    const doRecalc = String(req.query.recalc || "") === "1";
    const credits = doRecalc
      ? await recalcAndGetLeft(tableId)  // ⭐ รีคาลก์ครั้งเดียวตามคำสั่งผู้ใช้
      : await getCreditsForToday(tableId);

    return res.json({ ok: true, data: credits });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

/**
 * POST /warp/use
 * - ต้องล็อกอิน
 * - ใช้ customerId/tableId จาก session เท่านั้น (ห้ามส่งเองจาก client)
 * - body: { message?: string, imageUrl?: string }
 */
router.post("/warp/use", requireAuth, async (req, res) => {
  try {
    const customerId = req.session.customerId as number | undefined;
    const tableId    = req.session.tableId as number | undefined;
    if (!customerId) return res.status(401).json({ ok: false, error: "not-logged-in" });
    if (!tableId)    return res.status(400).json({ ok: false, error: "no-table-in-session" });

    // 1) อ่าน/ตรวจ input
    let { message, imageUrl } = (req.body || {}) as { message?: string; imageUrl?: string | null };
    message = normalizeMessage(String(message || ""));
    if (!message) return res.status(400).json({ ok: false, error: "message-required" });
    if (message.length > MAX_MSG_LEN) message = message.slice(0, MAX_MSG_LEN);
    if (hasBadWord(message)) return res.status(400).json({ ok: false, error: "message-blocked" });

    const imgCheck = validDataImage(imageUrl ?? null);
    if (!imgCheck.ok) return res.status(400).json({ ok: false, error: imgCheck.reason });

    // 2) คูลดาวน์ต่อโต๊ะ
    const now = Date.now();
    const last = TABLE_LAST_USE.get(tableId) || 0;
    if (now - last < TABLE_COOLDOWN_MS) {
      const wait = Math.ceil((TABLE_COOLDOWN_MS - (now - last)) / 1000);
      return res.status(429).json({ ok: false, error: `cooldown-${wait}s` });
    }

    // 3) หักสิทธิ์ + เข้าคิว
    const r = await consumeOneCredit(tableId, {
      message,
      imageUrl: imageUrl || undefined,
      customerId,
    });

    // 4) อัปเดตเวลาคูลดาวน์
    TABLE_LAST_USE.set(tableId, now);

    return res.json({ ok: true, left: r.left, queueId: r.queueId });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || "error" });
  }
});

export default router;
