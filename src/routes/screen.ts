import { Router } from "express";

const screenRouter = Router();

/**
 * Big Screen (ยังไม่มีข้อมูลจริง แค่ UI เต็มจอ)
 * TODO: ต่อ socket.io / fetch API เพื่อดึงข้อความแชท/วาปมาลง
 */
screenRouter.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.render("screen", {
    title: "Big Screen • Chat & Warp",
  });
});

export default screenRouter;
