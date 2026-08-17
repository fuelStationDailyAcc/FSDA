import { query, withTransaction } from "../db/index.js";
import { writeAudit } from "../services/audit.js";
import { calculateCashSummary, calculateLedgerRunningBalance } from "../services/cashCalculation.js";
import {
    calcFuelSalePaise,
    calcLitres,
    calcNetLitres,
    parseLitres,
    toPaise,
} from "../services/money.js";
import { ApiError } from "../utils/apiError.js";

function mapDaily(row) {
    if (!row) return null;
    return {
        id: row.id,
        accountDate: row.account_date,
        status: row.status,
        cashTakenPaise: Number(row.cash_taken_paise || 0),
        actualClosingCashPaise:
            row.actual_closing_cash_paise === null
                ? null
                : Number(row.actual_closing_cash_paise),
        notes: row.notes,
        closedAt: row.closed_at,
        closedBy: row.closed_by,
        reopenedAt: row.reopened_at,
        reopenedBy: row.reopened_by,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapReading(row) {
    return {
        id: row.id,
        dailyAccountId: row.daily_account_id,
        productId: row.product_id,
        productName: row.product_name,
        productType: row.product_type,
        meterLabel: row.meter_label,
        newReading: Number(row.new_reading),
        oldReading: Number(row.old_reading),
        litres: Number(row.litres),
        testingLitres: Number(row.testing_litres),
        netLitres: Number(row.net_litres),
        ratePaise: Number(row.rate_paise),
        totalSalePaise: Number(row.total_sale_paise),
        sortOrder: row.sort_order,
    };
}

function mapExpense(row) {
    return {
        id: row.id,
        dailyAccountId: row.daily_account_id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        description: row.description,
        amountPaise: Number(row.amount_paise),
        paymentMethodId: row.payment_method_id,
        paymentMethodName: row.payment_method_name,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
    };
}

function mapTxn(row) {
    return {
        id: row.id,
        dailyAccountId: row.daily_account_id,
        type: row.type,
        date: row.txn_date,
        time: row.txn_time,
        description: row.description,
        partyType: row.party_type,
        partyId: row.party_id,
        partyName: row.party_name,
        category: row.category,
        paymentMethodId: row.payment_method_id,
        paymentMethodName: row.payment_method_name,
        amountPaise: Number(row.amount_paise),
        referenceNumber: row.reference_number,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
    };
}

function assertOpen(account) {
    if (!account) throw new ApiError(404, "Daily account not found");
    if (account.status === "closed") {
        throw new ApiError(423, "Day is closed. Reopen to make changes.");
    }
}

function normalizeDate(input) {
    if (!input) throw new ApiError(400, "Date is required");
    const d = String(input).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
    }
    return d;
}

async function getPreviousProductReading(productId, beforeDate) {
    const result = await query(
        `SELECT r.new_reading
         FROM fuel_meter_readings r
         JOIN daily_accounts d ON d.id = r.daily_account_id
         WHERE r.product_id = $1 AND d.account_date < $2::date
         ORDER BY d.account_date DESC, r.updated_at DESC
         LIMIT 1`,
        [productId, beforeDate]
    );
    return result.rows[0] ? Number(result.rows[0].new_reading) : 0;
}

async function ensureDailyAccount(accountDate, userId) {
    const date = normalizeDate(accountDate);
    const existing = await query(
        `SELECT * FROM daily_accounts WHERE account_date = $1::date`,
        [date]
    );
    if (existing.rows[0]) return mapDaily(existing.rows[0]);

    return withTransaction(async (client) => {
        const inserted = await client.query(
            `INSERT INTO daily_accounts (account_date, created_by)
             VALUES ($1::date, $2)
             ON CONFLICT (account_date) DO UPDATE SET updated_at = daily_accounts.updated_at
             RETURNING *`,
            [date, userId]
        );
        const account = mapDaily(inserted.rows[0]);

        const products = await client.query(
            `SELECT * FROM fuel_products WHERE is_active = TRUE ORDER BY sort_order ASC`
        );

        let sort = 0;
        for (const product of products.rows) {
            const prev = await client.query(
                `SELECT r.new_reading
                 FROM fuel_meter_readings r
                 JOIN daily_accounts d ON d.id = r.daily_account_id
                 WHERE r.product_id = $1 AND d.account_date < $2::date
                 ORDER BY d.account_date DESC, r.updated_at DESC
                 LIMIT 1`,
                [product.id, date]
            );
            const oldReading = prev.rows[0] ? Number(prev.rows[0].new_reading) : 0;
            await client.query(
                `INSERT INTO fuel_meter_readings
                 (daily_account_id, product_id, meter_label, new_reading, old_reading,
                  litres, testing_litres, net_litres, rate_paise, total_sale_paise, sort_order)
                 VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $5, 0, $6)`,
                [
                    account.id,
                    product.id,
                    product.name,
                    oldReading,
                    Number(product.current_rate_paise),
                    sort++,
                ]
            );
        }

        const methods = await client.query(
            `SELECT id FROM payment_methods
             WHERE is_active = TRUE AND (reduces_cash = TRUE OR is_cash_taken = TRUE)
             ORDER BY sort_order ASC`
        );
        for (const method of methods.rows) {
            await client.query(
                `INSERT INTO daily_payment_collections (daily_account_id, payment_method_id, amount_paise)
                 VALUES ($1, $2, 0)
                 ON CONFLICT DO NOTHING`,
                [account.id, method.id]
            );
        }

        await writeAudit(
            {
                entityType: "daily_account",
                entityId: account.id,
                action: "create",
                userId,
                details: { accountDate: date },
            },
            client
        );

        return account;
    });
}

async function loadReadings(dailyAccountId) {
    const result = await query(
        `SELECT r.*, p.name AS product_name, p.product_type
         FROM fuel_meter_readings r
         JOIN fuel_products p ON p.id = r.product_id
         WHERE r.daily_account_id = $1
           AND p.is_active = TRUE
         ORDER BY r.sort_order ASC, p.name ASC`,
        [dailyAccountId]
    );
    return result.rows.map(mapReading);
}

async function loadCollections(dailyAccountId) {
    const result = await query(
        `SELECT c.*, m.name, m.code, m.method_type, m.reduces_cash, m.is_cash_taken, m.sort_order
         FROM daily_payment_collections c
         JOIN payment_methods m ON m.id = c.payment_method_id
         WHERE c.daily_account_id = $1
           AND m.is_active = TRUE
         ORDER BY m.sort_order ASC`,
        [dailyAccountId]
    );
    return result.rows.map((row) => ({
        id: row.id,
        paymentMethodId: row.payment_method_id,
        name: row.name,
        code: row.code,
        methodType: row.method_type,
        reducesCash: row.reduces_cash,
        isCashTaken: row.is_cash_taken,
        amountPaise: Number(row.amount_paise),
    }));
}

async function syncActivePaymentCollections(dailyAccountId) {
    const methods = await query(
        `SELECT id FROM payment_methods
         WHERE is_active = TRUE AND (reduces_cash = TRUE OR is_cash_taken = TRUE)
         ORDER BY sort_order ASC`
    );
    for (const method of methods.rows) {
        await query(
            `INSERT INTO daily_payment_collections (daily_account_id, payment_method_id, amount_paise)
             VALUES ($1, $2, 0)
             ON CONFLICT (daily_account_id, payment_method_id) DO NOTHING`,
            [dailyAccountId, method.id]
        );
    }
    // Drop leftover rows for inactive methods (amounts already migrated on schema ensure)
    await query(
        `DELETE FROM daily_payment_collections c
         USING payment_methods m
         WHERE c.payment_method_id = m.id
           AND c.daily_account_id = $1
           AND m.is_active = FALSE`,
        [dailyAccountId]
    );
}

async function loadExpenses(dailyAccountId) {
    const result = await query(
        `SELECT e.*, ec.name AS category_name, pm.name AS payment_method_name
         FROM expenses e
         LEFT JOIN expense_categories ec ON ec.id = e.category_id
         LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
         WHERE e.daily_account_id = $1
         ORDER BY e.created_at ASC`,
        [dailyAccountId]
    );
    return result.rows.map(mapExpense);
}

async function loadTransactions(dailyAccountId, filters = {}) {
    const values = [dailyAccountId];
    const clauses = ["t.daily_account_id = $1"];

    if (filters.type) {
        values.push(String(filters.type).toUpperCase());
        clauses.push(`t.type = $${values.length}`);
    }
    if (filters.category) {
        values.push(filters.category);
        clauses.push(`t.category ILIKE $${values.length}`);
    }
    if (filters.partyType) {
        values.push(filters.partyType);
        clauses.push(`t.party_type = $${values.length}`);
    }
    if (filters.partyId) {
        values.push(filters.partyId);
        clauses.push(`t.party_id = $${values.length}`);
    }
    if (filters.paymentMethodId) {
        values.push(filters.paymentMethodId);
        clauses.push(`t.payment_method_id = $${values.length}`);
    }
    if (filters.search) {
        values.push(`%${filters.search}%`);
        clauses.push(
            `(t.description ILIKE $${values.length} OR t.notes ILIKE $${values.length} OR t.reference_number ILIKE $${values.length})`
        );
    }
    if (filters.minAmountPaise !== undefined && filters.minAmountPaise !== "") {
        values.push(Number(filters.minAmountPaise));
        clauses.push(`t.amount_paise >= $${values.length}`);
    }
    if (filters.maxAmountPaise !== undefined && filters.maxAmountPaise !== "") {
        values.push(Number(filters.maxAmountPaise));
        clauses.push(`t.amount_paise <= $${values.length}`);
    }

    const sort = filters.sort === "amount"
        ? "t.amount_paise DESC"
        : filters.sort === "type"
          ? "t.type ASC, t.created_at ASC"
          : "t.txn_date ASC, t.txn_time ASC NULLS LAST, t.created_at ASC";

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const offset = (page - 1) * limit;

    const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM ledger_transactions t WHERE ${clauses.join(" AND ")}`,
        values
    );

    values.push(limit);
    values.push(offset);

    const result = await query(
        `SELECT t.*, pm.name AS payment_method_name,
            CASE
              WHEN t.party_type = 'customer' THEN (SELECT name FROM customers WHERE id = t.party_id)
              WHEN t.party_type = 'vendor' THEN (SELECT name FROM vendors WHERE id = t.party_id)
              ELSE NULL
            END AS party_name
         FROM ledger_transactions t
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY ${sort}
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
    );

    const withBalance = calculateLedgerRunningBalance(result.rows.map(mapTxn));
    return {
        items: withBalance,
        pagination: {
            page,
            limit,
            total: countResult.rows[0].total,
            totalPages: Math.ceil(countResult.rows[0].total / limit) || 1,
        },
    };
}

async function buildDayPayload(account, filters = {}) {
    await syncActivePaymentCollections(account.id);
    const readings = await loadReadings(account.id);
    const collections = await loadCollections(account.id);
    const expenses = await loadExpenses(account.id);
    const ledger = await loadTransactions(account.id, filters);
    const filterKeys = Object.keys(filters).filter(
        (k) => !["page", "limit", "sort"].includes(k) && filters[k] !== undefined && filters[k] !== ""
    );
    const allLedger = filterKeys.length
        ? await loadTransactions(account.id, { limit: 500 })
        : ledger;

    const totalFuelSalePaise = readings.reduce((s, r) => s + r.totalSalePaise, 0);
    const totalExpensePaise = expenses.reduce((s, e) => s + e.amountPaise, 0);
    const totalCreditPaise = allLedger.items
        .filter((t) => t.type === "CREDIT")
        .reduce((s, t) => s + t.amountPaise, 0);
    const totalDebitPaise = allLedger.items
        .filter((t) => t.type === "DEBIT")
        .reduce((s, t) => s + t.amountPaise, 0);

    const cashSummary = calculateCashSummary({
        totalFuelSalePaise,
        collections,
        totalExpensePaise,
        cashTakenPaise: account.cashTakenPaise,
        actualClosingCashPaise: account.actualClosingCashPaise,
    });

    const onlineCollectionsPaise = cashSummary.onlinePaise + cashSummary.otherNonCashPaise;

    return {
        account,
        readings,
        collections,
        expenses,
        ledger,
        cashSummary,
        kpis: {
            totalFuelSalesPaise: totalFuelSalePaise,
            totalCreditPaise: cashSummary.creditPaise,
            ledgerCreditPaise: totalCreditPaise,
            totalDebitPaise,
            totalExpensesPaise: totalExpensePaise,
            onlineCollectionsPaise,
            closingCashPaise: cashSummary.expectedClosingCashPaise,
        },
        reconciliation: {
            fuelSalesPaise: totalFuelSalePaise,
            creditSalesPaise: cashSummary.creditPaise,
            onlineCollectionsPaise,
            expensesPaise: totalExpensePaise,
            cashTakenPaise: cashSummary.cashTakenPaise,
            expectedClosingCashPaise: cashSummary.expectedClosingCashPaise,
            actualClosingCashPaise: cashSummary.actualClosingCashPaise,
            differencePaise: cashSummary.differencePaise,
        },
    };
}

export const DailyAccountService = {
    async getByDate(accountDate, userId, filters = {}) {
        const account = await ensureDailyAccount(accountDate, userId);
        return buildDayPayload(account, filters);
    },

    async updateCashTaken(accountDate, userId, cashTakenRupees) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        const cashTakenPaise = toPaise(cashTakenRupees);
        const result = await query(
            `UPDATE daily_accounts
             SET cash_taken_paise = $2, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [account.id, cashTakenPaise]
        );
        await writeAudit({
            entityType: "daily_account",
            entityId: account.id,
            action: "update_cash_taken",
            userId,
            details: { cashTakenPaise },
        });
        return buildDayPayload(mapDaily(result.rows[0]));
    },

    async upsertCollection(accountDate, userId, { paymentMethodId, amountRupees }) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        if (!paymentMethodId) throw new ApiError(400, "Payment method is required");
        const amountPaise = toPaise(amountRupees);
        if (amountPaise < 0) throw new ApiError(400, "Amount cannot be negative");

        await query(
            `INSERT INTO daily_payment_collections (daily_account_id, payment_method_id, amount_paise)
             VALUES ($1, $2, $3)
             ON CONFLICT (daily_account_id, payment_method_id)
             DO UPDATE SET amount_paise = EXCLUDED.amount_paise, updated_at = NOW()`,
            [account.id, paymentMethodId, amountPaise]
        );

        await writeAudit({
            entityType: "daily_payment_collection",
            entityId: account.id,
            action: "upsert",
            userId,
            details: { paymentMethodId, amountPaise },
        });

        return buildDayPayload(account);
    },

    async updateReading(accountDate, userId, readingId, payload) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);

        const existing = await query(
            `SELECT * FROM fuel_meter_readings WHERE id = $1 AND daily_account_id = $2`,
            [readingId, account.id]
        );
        if (!existing.rows[0]) throw new ApiError(404, "Meter reading not found");

        const row = existing.rows[0];
        const newReading = payload.newReading !== undefined
            ? parseLitres(payload.newReading)
            : Number(row.new_reading);
        const oldReading = payload.oldReading !== undefined
            ? parseLitres(payload.oldReading)
            : Number(row.old_reading);
        const testingLitres = payload.testingLitres !== undefined
            ? parseLitres(payload.testingLitres)
            : Number(row.testing_litres);
        const ratePaise = payload.rateRupees !== undefined
            ? toPaise(payload.rateRupees)
            : Number(row.rate_paise);

        if (newReading < oldReading) {
            throw new ApiError(400, "New reading cannot be less than old reading");
        }

        const litres = calcLitres(newReading, oldReading);
        const netLitres = calcNetLitres(litres, testingLitres);
        if (netLitres < 0) {
            throw new ApiError(400, "Testing litres cannot exceed LTR");
        }
        const totalSalePaise = calcFuelSalePaise(netLitres, ratePaise);

        const result = await query(
            `UPDATE fuel_meter_readings SET
                new_reading = $2,
                old_reading = $3,
                litres = $4,
                testing_litres = $5,
                net_litres = $6,
                rate_paise = $7,
                total_sale_paise = $8,
                meter_label = COALESCE($9, meter_label),
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [
                readingId,
                newReading,
                oldReading,
                litres,
                testingLitres,
                netLitres,
                ratePaise,
                totalSalePaise,
                payload.meterLabel ?? null,
            ]
        );

        await writeAudit({
            entityType: "fuel_meter_reading",
            entityId: readingId,
            action: "update",
            userId,
            details: { litres, netLitres, ratePaise, totalSalePaise },
        });

        return buildDayPayload(account);
    },

    async addReading(accountDate, userId, { productId }) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        if (!productId) throw new ApiError(400, "Product is required");

        const product = await query(`SELECT * FROM fuel_products WHERE id = $1`, [productId]);
        if (!product.rows[0]) throw new ApiError(404, "Product not found");

        const oldReading = await getPreviousProductReading(productId, account.accountDate);
        const sort = await query(
            `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
             FROM fuel_meter_readings WHERE daily_account_id = $1`,
            [account.id]
        );

        await query(
            `INSERT INTO fuel_meter_readings
             (daily_account_id, product_id, meter_label, new_reading, old_reading,
              litres, testing_litres, net_litres, rate_paise, total_sale_paise, sort_order)
             VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $5, 0, $6)`,
            [
                account.id,
                productId,
                product.rows[0].name,
                oldReading,
                Number(product.rows[0].current_rate_paise),
                sort.rows[0].next,
            ]
        );

        return buildDayPayload(account);
    },

    async addExpense(accountDate, userId, payload) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);

        const amountPaise = toPaise(payload.amountRupees);
        if (amountPaise <= 0) throw new ApiError(400, "Amount must be greater than 0");
        if (!payload.description?.trim()) throw new ApiError(400, "Description is required");

        await query(
            `INSERT INTO expenses
             (daily_account_id, category_id, description, amount_paise, payment_method_id, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                account.id,
                payload.categoryId || null,
                payload.description.trim(),
                amountPaise,
                payload.paymentMethodId || null,
                payload.notes || null,
                userId,
            ]
        );

        await writeAudit({
            entityType: "expense",
            entityId: account.id,
            action: "create",
            userId,
            details: { amountPaise, description: payload.description },
        });

        return buildDayPayload(account);
    },

    async deleteExpense(accountDate, userId, expenseId) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        const result = await query(
            `DELETE FROM expenses WHERE id = $1 AND daily_account_id = $2 RETURNING id`,
            [expenseId, account.id]
        );
        if (!result.rows[0]) throw new ApiError(404, "Expense not found");
        await writeAudit({
            entityType: "expense",
            entityId: expenseId,
            action: "delete",
            userId,
        });
        return buildDayPayload(account);
    },

    async addTransaction(accountDate, userId, payload) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);

        const type = String(payload.type || "").toUpperCase();
        if (!["DEBIT", "CREDIT"].includes(type)) {
            throw new ApiError(400, "Transaction type must be Debit or Credit");
        }
        const amountPaise = toPaise(payload.amountRupees);
        if (amountPaise <= 0) throw new ApiError(400, "Amount must be greater than 0");
        const personName = String(payload.personName || payload.description || "").trim();
        if (!personName) throw new ApiError(400, "Name of the person is required");
        const category = String(payload.category || type).trim() || type;

        const txnDate = normalizeDate(payload.date || accountDate);

        try {
            const result = await query(
                `INSERT INTO ledger_transactions
                 (daily_account_id, type, txn_date, txn_time, description, party_type, party_id,
                  category, payment_method_id, amount_paise, reference_number, notes,
                  idempotency_key, created_by)
                 VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                 RETURNING id`,
                [
                    account.id,
                    type,
                    txnDate,
                    payload.time || null,
                    personName,
                    payload.partyType || "other",
                    payload.partyId || null,
                    category,
                    payload.paymentMethodId || null,
                    amountPaise,
                    payload.referenceNumber || null,
                    payload.notes || null,
                    payload.idempotencyKey || null,
                    userId,
                ]
            );

            await writeAudit({
                entityType: "ledger_transaction",
                entityId: result.rows[0].id,
                action: "create",
                userId,
                details: { type, amountPaise },
            });
        } catch (error) {
            if (error.code === "23505") {
                throw new ApiError(409, "Duplicate transaction submission");
            }
            throw error;
        }

        return buildDayPayload(account);
    },

    async deleteTransaction(accountDate, userId, transactionId) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        const result = await query(
            `DELETE FROM ledger_transactions
             WHERE id = $1 AND daily_account_id = $2 RETURNING id`,
            [transactionId, account.id]
        );
        if (!result.rows[0]) throw new ApiError(404, "Transaction not found");
        await writeAudit({
            entityType: "ledger_transaction",
            entityId: transactionId,
            action: "delete",
            userId,
        });
        return buildDayPayload(account);
    },

    async closeDay(accountDate, userId, { actualClosingCashRupees }) {
        const account = await ensureDailyAccount(accountDate, userId);
        if (account.status === "closed") {
            throw new ApiError(400, "Day is already closed");
        }

        const actualClosingCashPaise = toPaise(actualClosingCashRupees);
        const payload = await buildDayPayload(account);
        const expected = payload.reconciliation.expectedClosingCashPaise;
        const differencePaise = actualClosingCashPaise - expected;

        const result = await query(
            `UPDATE daily_accounts SET
                status = 'closed',
                actual_closing_cash_paise = $2,
                closed_at = NOW(),
                closed_by = $3,
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [account.id, actualClosingCashPaise, userId]
        );

        await writeAudit({
            entityType: "daily_account",
            entityId: account.id,
            action: "close",
            userId,
            details: {
                actualClosingCashPaise,
                expectedClosingCashPaise: expected,
                differencePaise,
            },
        });

        return buildDayPayload(mapDaily(result.rows[0]));
    },

    async reopenDay(accountDate, userId, userRole) {
        const account = await ensureDailyAccount(accountDate, userId);
        if (account.status !== "closed") {
            throw new ApiError(400, "Day is not closed");
        }
        const role = String(userRole || "").toLowerCase();
        if (!["admin", "manager"].includes(role)) {
            throw new ApiError(403, "Only managers can reopen a closed day");
        }

        const result = await query(
            `UPDATE daily_accounts SET
                status = 'open',
                reopened_at = NOW(),
                reopened_by = $2,
                updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [account.id, userId]
        );

        await writeAudit({
            entityType: "daily_account",
            entityId: account.id,
            action: "reopen",
            userId,
        });

        return buildDayPayload(mapDaily(result.rows[0]));
    },

    async listLedgerNames({ type, search } = {}) {
        const values = [];
        const clauses = [`TRIM(t.description) <> ''`];

        if (type && ["DEBIT", "CREDIT"].includes(String(type).toUpperCase())) {
            values.push(String(type).toUpperCase());
            clauses.push(`t.type = $${values.length}`);
        }
        if (search?.trim()) {
            values.push(`%${search.trim()}%`);
            clauses.push(`t.description ILIKE $${values.length}`);
        }

        const ledgerResult = await query(
            `SELECT DISTINCT TRIM(t.description) AS name
             FROM ledger_transactions t
             WHERE ${clauses.join(" AND ")}
             ORDER BY name ASC
             LIMIT 100`,
            values
        );

        const partyValues = [];
        let partyFilter = "";
        if (search?.trim()) {
            partyValues.push(`%${search.trim()}%`);
            partyFilter = `WHERE name ILIKE $1`;
        }

        const [customers, vendors] = await Promise.all([
            query(
                `SELECT DISTINCT TRIM(name) AS name FROM customers ${partyFilter} ORDER BY name ASC LIMIT 50`,
                partyValues
            ),
            query(
                `SELECT DISTINCT TRIM(name) AS name FROM vendors ${partyFilter} ORDER BY name ASC LIMIT 50`,
                partyValues
            ),
        ]);

        const seen = new Set();
        const names = [];
        for (const row of [...ledgerResult.rows, ...customers.rows, ...vendors.rows]) {
            const name = String(row.name || "").trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            names.push(name);
        }
        names.sort((a, b) => a.localeCompare(b));
        return names.slice(0, 50);
    },

    async getLedgerTotals() {
        const result = await query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount_paise ELSE 0 END), 0)::bigint AS total_credit_paise,
                COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_paise ELSE 0 END), 0)::bigint AS total_debit_paise
             FROM ledger_transactions`
        );
        const row = result.rows[0] || {};
        const totalCreditPaise = Number(row.total_credit_paise || 0);
        const totalDebitPaise = Number(row.total_debit_paise || 0);
        return {
            totalCreditPaise,
            totalDebitPaise,
            totalUdhaarPaise: totalCreditPaise - totalDebitPaise,
        };
    },
};
