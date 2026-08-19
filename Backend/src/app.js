import "./loadEnv.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import userRouter from "./routes/user.routes.js";
import accountsRouter from "./routes/accounts.routes.js";
import staffRouter from "./routes/staff.routes.js";
import salaryRouter from "./routes/salary.routes.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    })
);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    res.status(dbOk ? 200 : 503).json({
        success: dbOk,
        status: dbOk ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/accounts", accountsRouter);
app.use("/api/v1/staff", staffRouter);
app.use("/api/v1/salaries", salaryRouter);

app.use((err, req, res, next) => {
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
        const message =
            field === "username" || field === "email"
                ? "User with this username or email already exists"
                : field === "idempotencyKey"
                  ? "Duplicate transaction submission"
                  : "Duplicate record";
        return res.status(409).json({
            success: false,
            message,
            errors: [],
        });
    }

    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Invalid id",
            errors: [],
        });
    }

    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
    });
});

export { app };
