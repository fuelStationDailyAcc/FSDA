import { query } from "../db/index.js";

function mapProduct(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        productType: row.product_type,
        currentRatePaise: Number(row.current_rate_paise),
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const FuelProduct = {
    async list({ activeOnly = false } = {}) {
        const result = await query(
            `SELECT * FROM fuel_products
             ${activeOnly ? "WHERE is_active = TRUE" : ""}
             ORDER BY sort_order ASC, name ASC`
        );
        return result.rows.map(mapProduct);
    },

    async findById(id) {
        const result = await query("SELECT * FROM fuel_products WHERE id = $1", [id]);
        return mapProduct(result.rows[0]);
    },

    async create({ name, productType, currentRatePaise, sortOrder = 0 }) {
        const result = await query(
            `INSERT INTO fuel_products (name, product_type, current_rate_paise, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name.trim(), productType || "Other", Number(currentRatePaise) || 0, sortOrder]
        );
        return mapProduct(result.rows[0]);
    },

    async update(id, { name, productType, currentRatePaise, isActive, sortOrder }) {
        const result = await query(
            `UPDATE fuel_products SET
                name = COALESCE($2, name),
                product_type = COALESCE($3, product_type),
                current_rate_paise = COALESCE($4, current_rate_paise),
                is_active = COALESCE($5, is_active),
                sort_order = COALESCE($6, sort_order),
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [
                id,
                name?.trim() ?? null,
                productType ?? null,
                currentRatePaise === undefined ? null : Number(currentRatePaise),
                isActive ?? null,
                sortOrder ?? null,
            ]
        );
        return mapProduct(result.rows[0]);
    },
};
