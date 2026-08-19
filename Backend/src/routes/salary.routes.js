import { Router } from "express";
import { requireOwner, verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createSalary,
    deleteSalary,
    listSalaries,
    updateSalary,
} from "../controllers/salary.controller.js";

const router = Router();

router.use(verifyJWT, requireOwner);

router.get("/", listSalaries);
router.post("/", createSalary);
router.patch("/:id", updateSalary);
router.delete("/:id", deleteSalary);

export default router;
