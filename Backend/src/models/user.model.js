import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query, withTransaction } from "../db/index.js";

function mapUser(row) {
    if (!row) return null;
    return {
        _id: row.id,
        username: row.username,
        email: row.email,
        password: row.password,
        role: row.role || "manager",
        stationName: row.station_name || null,
        refreshToken: row.refresh_token,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
        const values = [];
        const clauses = [];

        if (email) {
            values.push(email);
            clauses.push(`email = $${values.length}`);
        }
        if (username) {
            values.push(username);
            clauses.push(`username = $${values.length}`);
        }
        if (!clauses.length) return null;

        const result = await query(
            `SELECT * FROM users WHERE ${clauses.join(" OR ")} LIMIT 1`,
            values
        );
        return mapUser(result.rows[0]);
    },

    async findById(id) {
        const result = await query("SELECT * FROM users WHERE id = $1", [id]);
        return mapUser(result.rows[0]);
    },

    async create({ username, email, password, stationName }) {
        const hashed = await bcrypt.hash(password, 10);
        const result = await query(
            `INSERT INTO users (username, email, password, station_name)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                username.trim().toLowerCase(),
                email.trim().toLowerCase(),
                hashed,
                stationName.trim(),
            ]
        );
        return mapUser(result.rows[0]);
    },

    async setRefreshToken(id, refreshToken) {
        const result = await query(
            `UPDATE users
             SET refresh_token = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, refreshToken]
        );
        return mapUser(result.rows[0]);
    },

    async unsetRefreshToken(id) {
        await query(
            `UPDATE users
             SET refresh_token = NULL, updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    },

    async deleteById(id) {
        await withTransaction(async (client) => {
            await client.query(
                `UPDATE daily_accounts
                 SET created_by = NULL, closed_by = NULL, reopened_by = NULL
                 WHERE created_by = $1 OR closed_by = $1 OR reopened_by = $1`,
                [id]
            );
            await client.query(
                `UPDATE expenses SET created_by = NULL WHERE created_by = $1`,
                [id]
            );
            await client.query(
                `UPDATE ledger_transactions SET created_by = NULL WHERE created_by = $1`,
                [id]
            );
            await client.query(
                `UPDATE audit_logs SET user_id = NULL WHERE user_id = $1`,
                [id]
            );
            const result = await client.query(
                `DELETE FROM users WHERE id = $1 RETURNING id`,
                [id]
            );
            if (!result.rows[0]) {
                throw new Error("User not found");
            }
        });
    },

    isPasswordCorrect(user, password) {
        return bcrypt.compare(password, user.password);
    },

    generateAccessToken,
    generateRefreshToken,
    toPublicUser,
};
