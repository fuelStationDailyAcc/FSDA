import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { DailyAccount, Expense, LedgerTransaction } from "./accounts.model.js";
import { AuditLog } from "./auditLog.model.js";
import { isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password: { type: String, required: true },
        role: { type: String, default: "manager" },
        stationName: { type: String, default: null },
        refreshToken: { type: String, default: null },
    },
    { timestamps: true, collection: "users" }
);

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

function mapUser(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        _id: toId(row._id),
        username: row.username,
        email: row.email,
        password: row.password,
        role: row.role || "manager",
        stationName: row.stationName || null,
        refreshToken: row.refreshToken,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toPublicUser(user) {
    if (!user) return null;
    return {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || "manager",
        stationName: user.stationName || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}

function generateAccessToken(user) {
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
            username: user.username,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { _id: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
}

export const User = {
    async findByUsernameOrEmail({ username, email }) {
        const clauses = [];
        if (email) clauses.push({ email });
        if (username) clauses.push({ username });
        if (!clauses.length) return null;

        const doc = await UserModel.findOne({ $or: clauses });
        return mapUser(doc);
    },

    async findById(id) {
        if (!isValidObjectId(id)) return null;
        const doc = await UserModel.findById(id);
        return mapUser(doc);
    },

    async create({ username, email, password, stationName }) {
        const hashed = await bcrypt.hash(password, 10);
        const doc = await UserModel.create({
            username: username.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            password: hashed,
            stationName: stationName.trim(),
        });
        return mapUser(doc);
    },

    async setRefreshToken(id, refreshToken) {
        const doc = await UserModel.findByIdAndUpdate(
            id,
            { refreshToken },
            { new: true }
        );
        return mapUser(doc);
    },

    async unsetRefreshToken(id) {
        await UserModel.findByIdAndUpdate(id, { refreshToken: null });
    },

    async deleteById(id) {
        await DailyAccount.updateMany({ createdBy: id }, { $set: { createdBy: null } });
        await DailyAccount.updateMany({ closedBy: id }, { $set: { closedBy: null } });
        await DailyAccount.updateMany({ reopenedBy: id }, { $set: { reopenedBy: null } });
        await Expense.updateMany({ createdBy: id }, { $set: { createdBy: null } });
        await LedgerTransaction.updateMany({ createdBy: id }, { $set: { createdBy: null } });
        await AuditLog.updateMany({ userId: id }, { $set: { userId: null } });

        const result = await UserModel.findByIdAndDelete(id);
        if (!result) {
            throw new Error("User not found");
        }
    },

    isPasswordCorrect(user, password) {
        return bcrypt.compare(password, user.password);
    },

    generateAccessToken,
    generateRefreshToken,
    toPublicUser,
};
