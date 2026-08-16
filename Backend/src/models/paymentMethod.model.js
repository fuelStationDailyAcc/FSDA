import { query } from "../db/index.js";

function mapMethod(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        methodType: row.method_type,
        reducesCash: row.reduces_cash,
        isCashTaken: row.is_cash_taken,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const PaymentMethod = {
    async list({ activeOnly = false } = {}) {
        const result = await query(
            `SELECT * FROM payment_methods
             ${activeOnly ? "WHERE is_active = TRUE" : ""}
             ORDER BY sort_order ASC, name ASC`
        );
        return result.rows.map(mapMethod);
    },

    async findById(id) {
        const result = await query("SELECT * FROM payment_methods WHERE id = $1", [id]);
        return mapMethod(result.rows[0]);
    },

    async create(data) {
        const result = await query(
            `INSERT INTO payment_methods
             (name, code, method_type, reduces_cash, is_cash_taken, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                data.name.trim(),
                data.code.trim().toLowerCase().replace(/\s+/g, "_"),
                data.methodType || "other",
                data.reducesCash !== false,
                !!data.isCashTaken,
                data.sortOrder || 0,
            ]
        );
        return mapMethod(result.rows[0]);
    },

    async update(id, data) {
        const result = await query(
            `UPDATE payment_methods SET
                name = COALESCE($2, name),
                method_type = COALESCE($3, method_type),
                reduces_cash = COALESCE($4, reduces_cash),
                is_cash_taken = COALESCE($5, is_cash_taken),
                is_active = COALESCE($6, is_active),
                sort_order = COALESCE($7, sort_order),
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [
                id,
                data.name?.trim() ?? null,
                data.methodType ?? null,
                data.reducesCash ?? null,
                data.isCashTaken ?? null,
                data.isActive ?? null,
                data.sortOrder ?? null,
            ]
        );
        return mapMethod(result.rows[0]);
    },
};
