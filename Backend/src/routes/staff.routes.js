import { Router } from "express";
import { requireOwner, verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createStaff,
    deleteStaff,
    listStaff,
    updateStaff,
} from "../controllers/staff.controller.js";

const router = Router();

router.use(verifyJWT, requireOwner);

router.get("/", listStaff);
router.post("/", createStaff);
router.patch("/:id", updateStaff);
router.delete("/:id", deleteStaff);

export default router;
