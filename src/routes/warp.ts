import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getCreditsForToday, consumeOneCredit } from "../services/warp.service";

const router = Router();

/** หน้า UI ลูกค้า */
router.get("/warp", requireAuth, async (req, res) => {
  res.render("warp", { title: "แจกวาป" });
});

/**
 * GET /warp/credits
 * - ต้องล็อกอิน
 * - ใช้ tableId จาก session เท่านั้น
 * - คืนเครดิตของ "โต๊ะนี้" วันนี้
 */
router.get("/warp/credits", requireAuth, async (req, res) => {
  try {
    const tableId = req.session.tableId as number | undefined;
    if (!tableId) return res.status(400).json({ ok: false, error: "no-table-in-session" });

    const credits = await getCreditsForToday(tableId);
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

    const { message, imageUrl } = req.body || {};
    // validate แบบเบา ๆ (เดี๋ยวค่อยเพิ่มเงื่อนไขความยาว/รูปแบบ)
    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ ok: false, error: "message-required" });
    }

    // หัก 1 สิทธิ์ + เข้าคิว
    const r = await consumeOneCredit(tableId, {
      message: String(message).slice(0, 300), // กันยาวเกิน
      imageUrl: imageUrl ? String(imageUrl) : undefined,
      customerId,
    });

    return res.json({ ok: true, left: r.left, queueId: r.queueId });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || "error" });
  }
});

export default router;
