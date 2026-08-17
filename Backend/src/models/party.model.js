import { query } from "../db/index.js";

function mapParty(row, type) {
    if (!row) return null;
    return {
        id: row.id,
        type,
        name: row.name,
        phone: row.phone,
        notes: row.notes,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function partyBalances(table, partyType) {
    const result = await query(
        `SELECT p.*,
            COALESCE(SUM(CASE WHEN t.type = 'CREDIT' AND $1 = 'customer' THEN t.amount_paise
                              WHEN t.type = 'DEBIT' AND $1 = 'vendor' THEN t.amount_paise
                              ELSE 0 END), 0)::bigint AS total_in_paise,
            COALESCE(SUM(CASE WHEN t.type = 'DEBIT' AND $1 = 'customer' THEN t.amount_paise
                              WHEN t.type = 'CREDIT' AND $1 = 'vendor' THEN t.amount_paise
                              ELSE 0 END), 0)::bigint AS total_out_paise
         FROM ${table} p
         LEFT JOIN ledger_transactions t
           ON t.party_type = $1 AND t.party_id = p.id
         GROUP BY p.id
         ORDER BY p.name ASC`,
        [partyType]
    );

    return result.rows.map((row) => {
        const totalIn = Number(row.total_in_paise);
        const totalOut = Number(row.total_out_paise);
        const base = mapParty(row, partyType);
        if (partyType === "customer") {
            return {
                ...base,
                totalCreditPaise: totalIn,
                totalPaidPaise: totalOut,
                outstandingPaise: totalIn - totalOut,
            };
        }
        return {
            ...base,
            totalPurchasesPaise: totalIn,
            totalPaidPaise: totalOut,
            outstandingPaise: totalIn - totalOut,
        };
    });
}

export const Customer = {
    async list() {
        return partyBalances("customers", "customer");
    },

    async create({ name, phone, notes }) {
        const result = await query(
            `INSERT INTO customers (name, phone, notes) VALUES ($1, $2, $3) RETURNING *`,
            [name.trim(), phone || null, notes || null]
        );
        return mapParty(result.rows[0], "customer");
    },

    async update(id, { name, phone, notes, isActive }) {
        const result = await query(
            `UPDATE customers SET
                name = COALESCE($2, name),
                phone = COALESCE($3, phone),
                notes = COALESCE($4, notes),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, name?.trim() ?? null, phone ?? null, notes ?? null, isActive ?? null]
        );
        return mapParty(result.rows[0], "customer");
    },

    async delete(id) {
        await query(
            `UPDATE ledger_transactions
             SET party_id = NULL, updated_at = NOW()
             WHERE party_type = 'customer' AND party_id = $1`,
            [id]
        );
        const result = await query(`DELETE FROM customers WHERE id = $1 RETURNING *`, [id]);
        return mapParty(result.rows[0], "customer");
    },
};

export const Vendor = {
    async list() {
        return partyBalances("vendors", "vendor");
    },

    async create({ name, phone, notes }) {
        const result = await query(
            `INSERT INTO vendors (name, phone, notes) VALUES ($1, $2, $3) RETURNING *`,
            [name.trim(), phone || null, notes || null]
        );
        return mapParty(result.rows[0], "vendor");
    },

    async update(id, { name, phone, notes, isActive }) {
        const result = await query(
            `UPDATE vendors SET
                name = COALESCE($2, name),
                phone = COALESCE($3, phone),
                notes = COALESCE($4, notes),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, name?.trim() ?? null, phone ?? null, notes ?? null, isActive ?? null]
        );
        return mapParty(result.rows[0], "vendor");
    },
};
