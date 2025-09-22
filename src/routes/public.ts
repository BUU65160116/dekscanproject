import { Router } from "express";
import { showLogin, submitLogin, showRegister, submitRegister } from "../controllers/user.controller";
// import { showRegister } from "../controllers/user.controller"; //

const router = Router();

// เมื่อลูกค้าสแกน จะเข้าหน้า Login ก่อนเสมอ
router.get("/login", showLogin);
router.post("/login", submitLogin);

// ใหม่: แสดงหน้า Register (ยังไม่ทำ POST)
router.get("/register", showRegister);
router.post("/register", submitRegister);

// (ยังไม่ทำ register ใน step นี้)
export default router;
