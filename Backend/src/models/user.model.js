import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/index.js";

function mapUser(row) {
    if (!row) return null;
    return {
        _id: row.id,
        username: row.username,
        email: row.email,
        password: row.password,
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

    async create({ username, email, password }) {
        const hashed = await bcrypt.hash(password, 10);
        const result = await query(
            `INSERT INTO users (username, email, password)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [username.trim().toLowerCase(), email.trim().toLowerCase(), hashed]
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

    isPasswordCorrect(user, password) {
        return bcrypt.compare(password, user.password);
    },

    generateAccessToken,
    generateRefreshToken,
    toPublicUser,
};
