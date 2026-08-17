import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { DailyAccount, Expense, LedgerTransaction } from "./accounts.model.js";
import { AuditLog } from "./auditLog.model.js";
import { isValidObjectId, leanDoc, toId } from "../db/helpers.js";
import {
    DEFAULT_STAFF_PERMISSIONS,
    EMPTY_PERMISSIONS,
    FULL_PERMISSIONS,
    isOwner,
    normalizePermissions,
} from "../constants/permissions.js";

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
        password: { type: String, required: true },
        role: { type: String, default: "manager" },
        stationName: { type: String, default: null },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        permissions: {
            accounts: {
                read: { type: Boolean, default: false },
                write: { type: Boolean, default: false },
            },
            ledger: {
                read: { type: Boolean, default: false },
                write: { type: Boolean, default: false },
            },
            settings: {
                read: { type: Boolean, default: false },
                write: { type: Boolean, default: false },
            },
        },
        refreshToken: { type: String, default: null },
    },
    { timestamps: true, collection: "users" }
);

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

function mapUser(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    const ownerId = toId(row.ownerId);
    const role = row.role || (ownerId ? "staff" : "manager");
    return {
        _id: toId(row._id),
        username: row.username,
        email: row.email || null,
        password: row.password,
        role,
        stationName: row.stationName || null,
        ownerId,
        permissions: normalizePermissions(
            row.permissions,
            ownerId ? EMPTY_PERMISSIONS : FULL_PERMISSIONS
        ),
        refreshToken: row.refreshToken,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toPublicUser(user) {
    if (!user) return null;
    const owner = isOwner(user);
    return {
        _id: user._id,
        username: user.username,
        email: user.email || null,
        role: owner ? (user.role === "admin" ? "admin" : "manager") : "staff",
        stationName: user.stationName || null,
        ownerId: user.ownerId || null,
        isOwner: owner,
        permissions: owner
            ? FULL_PERMISSIONS
            : normalizePermissions(user.permissions, EMPTY_PERMISSIONS),
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

    async create({ username, email, password, stationName, role, ownerId, permissions }) {
        const hashed = await bcrypt.hash(password, 10);
        const payload = {
            username: username.trim().toLowerCase(),
            password: hashed,
            stationName: stationName?.trim() || null,
            role: role || (ownerId ? "staff" : "manager"),
        };
        if (email?.trim()) payload.email = email.trim().toLowerCase();
        if (ownerId) payload.ownerId = ownerId;
        if (permissions) {
            payload.permissions = normalizePermissions(
                permissions,
                ownerId ? DEFAULT_STAFF_PERMISSIONS : FULL_PERMISSIONS
            );
        } else if (ownerId) {
            payload.permissions = DEFAULT_STAFF_PERMISSIONS;
        } else {
            payload.permissions = FULL_PERMISSIONS;
        }

        const doc = await UserModel.create(payload);
        return mapUser(doc);
    },

    async listByOwner(ownerId) {
        if (!isValidObjectId(ownerId)) return [];
        const docs = await UserModel.find({ ownerId }).sort({ createdAt: -1 });
        return docs.map(mapUser);
    },

    async findStaffForOwner(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const doc = await UserModel.findOne({ _id: id, ownerId });
        return mapUser(doc);
    },

    async updateStaff(id, ownerId, { username, password, permissions }) {
        const staff = await this.findStaffForOwner(id, ownerId);
        if (!staff) return null;

        const $set = {};
        if (username?.trim()) {
            $set.username = username.trim().toLowerCase();
        }
        if (password?.trim()) {
            $set.password = await bcrypt.hash(password.trim(), 10);
            $set.refreshToken = null;
        }
        if (permissions) {
            $set.permissions = normalizePermissions(permissions, EMPTY_PERMISSIONS);
        }

        const doc = await UserModel.findOneAndUpdate(
            { _id: id, ownerId },
            { $set },
            { new: true }
        );
        return mapUser(doc);
    },

    async deleteStaff(id, ownerId) {
        const staff = await this.findStaffForOwner(id, ownerId);
        if (!staff) return null;
        await this.deleteById(id);
        return staff;
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
        const staffIds = await UserModel.find({ ownerId: id }).distinct("_id");
        const ids = [id, ...staffIds];

        await UserModel.deleteMany({ ownerId: id });
        await DailyAccount.updateMany({ createdBy: { $in: ids } }, { $set: { createdBy: null } });
        await DailyAccount.updateMany({ closedBy: { $in: ids } }, { $set: { closedBy: null } });
        await DailyAccount.updateMany({ reopenedBy: { $in: ids } }, { $set: { reopenedBy: null } });
        await Expense.updateMany({ createdBy: { $in: ids } }, { $set: { createdBy: null } });
        await LedgerTransaction.updateMany({ createdBy: { $in: ids } }, { $set: { createdBy: null } });
        await AuditLog.updateMany({ userId: { $in: ids } }, { $set: { userId: null } });

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
