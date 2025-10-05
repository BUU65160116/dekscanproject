import { Request, Response } from "express";
import * as adminService from "../services/admin.service"; // DB งานแชทของแอดมิน (soft delete/clear)

export function showLogin(_req: Request, res: Response) {
  // เดิม: res.render("admin/login", { error: null })
  return res.render("admin/login", { error: null });
}

export function submitLogin(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string };

  const ADMIN_USER = process.env.ADMIN_USER ?? "";
  const ADMIN_PASS = process.env.ADMIN_PASS ?? "";

  const ok = (username ?? "").trim() === ADMIN_USER && (password ?? "") === ADMIN_PASS;
  if (!ok) {
    return res.status(401).render("admin/login", { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }

  req.session.isAdmin = true;
  return req.session.save(() => res.redirect("/admin/dashboard"));
}

export function showDashboard(_req: Request, res: Response) {
  return res.render("admin/dashboard", { title: "Dashboard" });
}

export function logout(req: Request, res: Response) {
  req.session.isAdmin = false;
  return req.session.destroy(() => res.redirect("/admin/login"));
}

export function redirectChat(_req: Request, res: Response) {
  // เดิม: res.redirect("/admin/dashboard#chat")
  return res.redirect("/admin/dashboard#chat");
}

export async function getChatData(_req: Request, res: Response) {
  try {
    const rows = await adminService.fetchChatRows(); // เดิม: SELECT ... FROM chat_message ...
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("admin.chat.data error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

export async function deleteMessage(req: any, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

  try {
    await adminService.softDeleteMessage(id);      // เดิม: UPDATE ... IsDeleted = 1 WHERE ChatID = ?
    req.io?.emit("deleteMessage", { chatId: id }); // เดิม: broadcast ให้จอใหญ่ลบทันที
    return res.json({ ok: true });
  } catch (err) {
    console.error("admin.chat.delete error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

export async function clearChat(req: any, res: Response) {
  try {
    await adminService.softClearAll();   // เดิม: UPDATE chat_message SET IsDeleted = 1 WHERE IsDeleted = 0
    req.io?.emit("clearChat", {});       // เดิม: broadcast เคลียร์ทั้งหมด
    return res.json({ ok: true });
  } catch (err) {
    console.error("admin.chat.clear error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}