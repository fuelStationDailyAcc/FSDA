import { pool } from "./index.js";

const DEFAULT_PRODUCTS = [
    { name: "MS", product_type: "MS", rate_paise: 10491, sort_order: 1 },
    { name: "HSD", product_type: "HSD", rate_paise: 9484, sort_order: 2 },
    { name: "CNG", product_type: "CNG", rate_paise: 0, sort_order: 3 },
];

const LEGACY_PUMP_PRODUCT_NAMES = ["MS Pump 2", "HSD Pump 2"];

const DEFAULT_PAYMENT_METHODS = [
    { name: "Cash", code: "cash", method_type: "cash", reduces_cash: false, is_cash_taken: false, sort_order: 1 },
    { name: "Credit", code: "credit", method_type: "credit", reduces_cash: true, is_cash_taken: false, sort_order: 2 },
    { name: "Card", code: "card", method_type: "card", reduces_cash: true, is_cash_taken: false, sort_order: 3 },
    { name: "Online Payments", code: "online_payments", method_type: "online", reduces_cash: true, is_cash_taken: false, sort_order: 4 },
    { name: "Other", code: "other", method_type: "other", reduces_cash: true, is_cash_taken: false, sort_order: 5 },
];

const LEGACY_ONLINE_APP_CODES = [
    "paytm",
    "gpay",
    "phonepe",
    "upi",
    "bank_transfer",
    "manual_online",
    "debit_card",
];

const DEFAULT_EXPENSE_CATEGORIES = [
    "General Expense",
    "Generator",
    "Cashback",
    "Electricity",
    "Maintenance",
    "Salary",
    "Transport",
    "Cleaning",
    "Station Supplies",
    "Other",
];

const DEFAULT_TXN_CATEGORIES = [
    { name: "Generator Expense", type: "DEBIT" },
    { name: "Vendor Payment", type: "DEBIT" },
    { name: "Salary", type: "DEBIT" },
    { name: "Maintenance", type: "DEBIT" },
    { name: "Cash Withdrawal", type: "DEBIT" },
    { name: "Customer Payment", type: "CREDIT" },
    { name: "Fuel Sale", type: "CREDIT" },
    { name: "Other Income", type: "CREDIT" },
    { name: "Bank Transfer Received", type: "CREDIT" },
    { name: "Other", type: "BOTH" },
];

export async function ensureSchema() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'manager'
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS station_name VARCHAR(150)
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS fuel_products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                product_type VARCHAR(50) NOT NULL DEFAULT 'Other',
                current_rate_paise BIGINT NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS payment_methods (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) NOT NULL UNIQUE,
                method_type VARCHAR(30) NOT NULL DEFAULT 'other',
                reduces_cash BOOLEAN NOT NULL DEFAULT TRUE,
                is_cash_taken BOOLEAN NOT NULL DEFAULT FALSE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS expense_categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL UNIQUE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS transaction_categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                type VARCHAR(10) NOT NULL DEFAULT 'BOTH',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(150) NOT NULL,
                phone VARCHAR(30),
                notes TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS vendors (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(150) NOT NULL,
                phone VARCHAR(30),
                notes TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                account_date DATE NOT NULL UNIQUE,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                cash_taken_paise BIGINT NOT NULL DEFAULT 0,
                actual_closing_cash_paise BIGINT,
                notes TEXT,
                closed_at TIMESTAMPTZ,
                closed_by UUID REFERENCES users(id),
                reopened_at TIMESTAMPTZ,
                reopened_by UUID REFERENCES users(id),
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT daily_accounts_status_chk CHECK (status IN ('open', 'closed'))
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS fuel_meter_readings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                daily_account_id UUID NOT NULL REFERENCES daily_accounts(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES fuel_products(id),
                meter_label VARCHAR(100),
                new_reading NUMERIC(14,3) NOT NULL DEFAULT 0,
                old_reading NUMERIC(14,3) NOT NULL DEFAULT 0,
                litres NUMERIC(14,3) NOT NULL DEFAULT 0,
                testing_litres NUMERIC(14,3) NOT NULL DEFAULT 0,
                net_litres NUMERIC(14,3) NOT NULL DEFAULT 0,
                rate_paise BIGINT NOT NULL DEFAULT 0,
                total_sale_paise BIGINT NOT NULL DEFAULT 0,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_payment_collections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                daily_account_id UUID NOT NULL REFERENCES daily_accounts(id) ON DELETE CASCADE,
                payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
                amount_paise BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (daily_account_id, payment_method_id)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                daily_account_id UUID NOT NULL REFERENCES daily_accounts(id) ON DELETE CASCADE,
                category_id UUID REFERENCES expense_categories(id),
                description VARCHAR(255) NOT NULL,
                amount_paise BIGINT NOT NULL,
                payment_method_id UUID REFERENCES payment_methods(id),
                notes TEXT,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT expenses_amount_chk CHECK (amount_paise > 0)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS ledger_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                daily_account_id UUID NOT NULL REFERENCES daily_accounts(id) ON DELETE CASCADE,
                type VARCHAR(10) NOT NULL,
                txn_date DATE NOT NULL,
                txn_time TIME,
                description TEXT NOT NULL,
                party_type VARCHAR(20),
                party_id UUID,
                category VARCHAR(100) NOT NULL,
                payment_method_id UUID REFERENCES payment_methods(id),
                amount_paise BIGINT NOT NULL,
                reference_number VARCHAR(100),
                notes TEXT,
                idempotency_key VARCHAR(100) UNIQUE,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT ledger_type_chk CHECK (type IN ('DEBIT', 'CREDIT')),
                CONSTRAINT ledger_amount_chk CHECK (amount_paise > 0),
                CONSTRAINT ledger_party_type_chk CHECK (
                    party_type IS NULL OR party_type IN ('customer', 'vendor', 'other')
                )
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entity_type VARCHAR(50) NOT NULL,
                entity_id UUID,
                action VARCHAR(50) NOT NULL,
                user_id UUID REFERENCES users(id),
                details JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_accounts_date ON daily_accounts(account_date);
            CREATE INDEX IF NOT EXISTS idx_fuel_readings_daily ON fuel_meter_readings(daily_account_id);
            CREATE INDEX IF NOT EXISTS idx_expenses_daily ON expenses(daily_account_id);
            CREATE INDEX IF NOT EXISTS idx_ledger_daily ON ledger_transactions(daily_account_id);
            CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_transactions(txn_date);
            CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_transactions(party_type, party_id);
            CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
        `);

        await seedDefaults(client);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function seedDefaults(client) {
    const products = await client.query("SELECT COUNT(*)::int AS c FROM fuel_products");
    if (products.rows[0].c === 0) {
        for (const p of DEFAULT_PRODUCTS) {
            await client.query(
                `INSERT INTO fuel_products (name, product_type, current_rate_paise, sort_order)
                 VALUES ($1, $2, $3, $4)`,
                [p.name, p.product_type, p.rate_paise, p.sort_order]
            );
        }
    } else {
        await deactivateLegacyPumpProducts(client);
    }

    const methods = await client.query("SELECT COUNT(*)::int AS c FROM payment_methods");
    if (methods.rows[0].c === 0) {
        for (const m of DEFAULT_PAYMENT_METHODS) {
            await client.query(
                `INSERT INTO payment_methods
                 (name, code, method_type, reduces_cash, is_cash_taken, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [m.name, m.code, m.method_type, m.reduces_cash, m.is_cash_taken, m.sort_order]
            );
        }
    } else {
        await consolidateOnlinePaymentMethods(client);
    }

    const expenseCats = await client.query("SELECT COUNT(*)::int AS c FROM expense_categories");
    if (expenseCats.rows[0].c === 0) {
        let i = 1;
        for (const name of DEFAULT_EXPENSE_CATEGORIES) {
            await client.query(
                `INSERT INTO expense_categories (name, sort_order) VALUES ($1, $2)`,
                [name, i++]
            );
        }
    }

    const txnCats = await client.query("SELECT COUNT(*)::int AS c FROM transaction_categories");
    if (txnCats.rows[0].c === 0) {
        let i = 1;
        for (const c of DEFAULT_TXN_CATEGORIES) {
            await client.query(
                `INSERT INTO transaction_categories (name, type, sort_order) VALUES ($1, $2, $3)`,
                [c.name, c.type, i++]
            );
        }
    }
}

async function deactivateLegacyPumpProducts(client) {
    await client.query(
        `UPDATE fuel_products
         SET is_active = FALSE, updated_at = NOW()
         WHERE name = ANY($1::text[])`,
        [LEGACY_PUMP_PRODUCT_NAMES]
    );
    await client.query(
        `UPDATE fuel_products SET sort_order = 1, updated_at = NOW() WHERE name = 'MS'`
    );
    await client.query(
        `UPDATE fuel_products SET sort_order = 2, updated_at = NOW() WHERE name = 'HSD'`
    );
    await client.query(
        `UPDATE fuel_products SET sort_order = 3, updated_at = NOW() WHERE name = 'CNG'`
    );
}

async function consolidateOnlinePaymentMethods(client) {
    await client.query(
        `INSERT INTO payment_methods
         (name, code, method_type, reduces_cash, is_cash_taken, sort_order, is_active)
         VALUES ('Online Payments', 'online_payments', 'online', TRUE, FALSE, 4, TRUE)
         ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            method_type = EXCLUDED.method_type,
            reduces_cash = EXCLUDED.reduces_cash,
            is_cash_taken = EXCLUDED.is_cash_taken,
            is_active = TRUE,
            sort_order = EXCLUDED.sort_order,
            updated_at = NOW()`
    );

    const online = await client.query(
        `SELECT id FROM payment_methods WHERE code = 'online_payments' LIMIT 1`
    );
    const onlineId = online.rows[0]?.id;

    if (onlineId) {
        // Move any legacy app collection amounts into Online Payments
        await client.query(
            `INSERT INTO daily_payment_collections (daily_account_id, payment_method_id, amount_paise)
             SELECT c.daily_account_id, $1::uuid, SUM(c.amount_paise)::bigint
             FROM daily_payment_collections c
             JOIN payment_methods m ON m.id = c.payment_method_id
             WHERE m.code = ANY($2::text[])
             GROUP BY c.daily_account_id
             ON CONFLICT (daily_account_id, payment_method_id)
             DO UPDATE SET
                amount_paise = daily_payment_collections.amount_paise + EXCLUDED.amount_paise,
                updated_at = NOW()`,
            [onlineId, LEGACY_ONLINE_APP_CODES]
        );

        await client.query(
            `DELETE FROM daily_payment_collections c
             USING payment_methods m
             WHERE c.payment_method_id = m.id
               AND m.code = ANY($1::text[])`,
            [LEGACY_ONLINE_APP_CODES]
        );
    }

    await client.query(
        `UPDATE payment_methods
         SET is_active = FALSE, updated_at = NOW()
         WHERE code = ANY($1::text[])`,
        [LEGACY_ONLINE_APP_CODES]
    );

    // Keep Card/Other/Cash/Credit active with sensible sort order
    await client.query(
        `UPDATE payment_methods SET sort_order = 1, is_active = TRUE, updated_at = NOW() WHERE code = 'cash'`
    );
    await client.query(
        `UPDATE payment_methods SET sort_order = 2, is_active = TRUE, updated_at = NOW() WHERE code = 'credit'`
    );
    await client.query(
        `UPDATE payment_methods SET sort_order = 3, is_active = TRUE, updated_at = NOW() WHERE code = 'card'`
    );
    await client.query(
        `UPDATE payment_methods SET sort_order = 5, is_active = TRUE, updated_at = NOW() WHERE code = 'other'`
    );
}
