import { query } from "../db/index.js";

function mapCat(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
    };
}

function mapTxnCat(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
    };
}

export const ExpenseCategory = {
    async list({ activeOnly = false } = {}) {
        const result = await query(
            `SELECT * FROM expense_categories
             ${activeOnly ? "WHERE is_active = TRUE" : ""}
             ORDER BY sort_order ASC, name ASC`
        );
        return result.rows.map(mapCat);
    },

    async create({ name, sortOrder = 0 }) {
        const result = await query(
            `INSERT INTO expense_categories (name, sort_order) VALUES ($1, $2) RETURNING *`,
            [name.trim(), sortOrder]
        );
        return mapCat(result.rows[0]);
    },

    async update(id, { name, isActive, sortOrder }) {
        const result = await query(
            `UPDATE expense_categories SET
                name = COALESCE($2, name),
                is_active = COALESCE($3, is_active),
                sort_order = COALESCE($4, sort_order)
             WHERE id = $1 RETURNING *`,
            [id, name?.trim() ?? null, isActive ?? null, sortOrder ?? null]
        );
        return mapCat(result.rows[0]);
    },
};

export const TransactionCategory = {
    async list({ activeOnly = false } = {}) {
        const result = await query(
            `SELECT * FROM transaction_categories
             ${activeOnly ? "WHERE is_active = TRUE" : ""}
             ORDER BY sort_order ASC, name ASC`
        );
        return result.rows.map(mapTxnCat);
    },
};
