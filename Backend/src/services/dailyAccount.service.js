import {
    DailyAccount,
    DailyPaymentCollection,
    Expense,
    FuelMeterReading,
    LedgerTransaction,
} from "../models/accounts.model.js";
import { FuelProductModel } from "../models/fuelProduct.model.js";
import { PaymentMethodModel } from "../models/paymentMethod.model.js";
import { ExpenseCategoryModel } from "../models/catalog.model.js";
import { CustomerModel, VendorModel } from "../models/party.model.js";
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
import {
    asObjectId,
    escapeRegex,
    isDuplicateKeyError,
    isValidObjectId,
    leanDoc,
    toId,
} from "../db/helpers.js";

function mapDaily(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        accountDate: row.accountDate,
        status: row.status,
        cashTakenPaise: Number(row.cashTakenPaise || 0),
        actualClosingCashPaise:
            row.actualClosingCashPaise === null || row.actualClosingCashPaise === undefined
                ? null
                : Number(row.actualClosingCashPaise),
        notes: row.notes,
        closedAt: row.closedAt,
        closedBy: toId(row.closedBy),
        reopenedAt: row.reopenedAt,
        reopenedBy: toId(row.reopenedBy),
        createdBy: toId(row.createdBy),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function mapReading(row, product) {
    return {
        id: toId(row._id),
        dailyAccountId: toId(row.dailyAccountId),
        productId: toId(row.productId),
        productName: product?.name,
        productType: product?.productType,
        meterLabel: row.meterLabel,
        newReading: Number(row.newReading),
        oldReading: Number(row.oldReading),
        litres: Number(row.litres),
        testingLitres: Number(row.testingLitres),
        netLitres: Number(row.netLitres),
        ratePaise: Number(row.ratePaise),
        totalSalePaise: Number(row.totalSalePaise),
        sortOrder: row.sortOrder,
    };
}

function mapExpense(row, category, paymentMethod) {
    return {
        id: toId(row._id),
        dailyAccountId: toId(row.dailyAccountId),
        categoryId: toId(row.categoryId),
        categoryName: category?.name || null,
        description: row.description,
        amountPaise: Number(row.amountPaise),
        paymentMethodId: toId(row.paymentMethodId),
        paymentMethodName: paymentMethod?.name || null,
        notes: row.notes,
        createdBy: toId(row.createdBy),
        createdAt: row.createdAt,
    };
}

function mapTxn(row, paymentMethod, partyName) {
    return {
        id: toId(row._id),
        dailyAccountId: toId(row.dailyAccountId),
        type: row.type,
        date: row.txnDate,
        time: row.txnTime,
        description: row.description,
        partyType: row.partyType,
        partyId: toId(row.partyId),
        partyName: partyName || null,
        category: row.category,
        paymentMethodId: toId(row.paymentMethodId),
        paymentMethodName: paymentMethod?.name || null,
        amountPaise: Number(row.amountPaise),
        referenceNumber: row.referenceNumber,
        notes: row.notes,
        createdBy: toId(row.createdBy),
        createdAt: row.createdAt,
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

function byIdMap(docs) {
    return new Map(docs.map((doc) => [toId(doc._id), doc]));
}

async function getPreviousProductReading(productId, beforeDate) {
    const result = await FuelMeterReading.aggregate([
        { $match: { productId: asObjectId(productId) } },
        {
            $lookup: {
                from: "daily_accounts",
                localField: "dailyAccountId",
                foreignField: "_id",
                as: "day",
            },
        },
        { $unwind: "$day" },
        { $match: { "day.accountDate": { $lt: beforeDate } } },
        { $sort: { "day.accountDate": -1, updatedAt: -1 } },
        { $limit: 1 },
    ]);

    return result[0] ? Number(result[0].newReading) : 0;
}

async function ensureDailyAccount(accountDate, userId) {
    const date = normalizeDate(accountDate);
    const existing = await DailyAccount.findOne({ accountDate: date });
    if (existing) return mapDaily(existing);

    let accountDoc;
    try {
        accountDoc = await DailyAccount.create({
            accountDate: date,
            createdBy: isValidObjectId(userId) ? userId : null,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            const raced = await DailyAccount.findOne({ accountDate: date });
            if (raced) return mapDaily(raced);
        }
        throw error;
    }

    const account = mapDaily(accountDoc);
    const products = await FuelProductModel.find({ isActive: true }).sort({ sortOrder: 1 });

    let sort = 0;
    for (const product of products) {
        const oldReading = await getPreviousProductReading(product._id, date);
        await FuelMeterReading.updateOne(
            { dailyAccountId: accountDoc._id, productId: product._id, meterLabel: product.name },
            {
                $setOnInsert: {
                    newReading: oldReading,
                    oldReading,
                    litres: 0,
                    testingLitres: 0,
                    netLitres: 0,
                    ratePaise: Number(product.currentRatePaise),
                    totalSalePaise: 0,
                    sortOrder: sort,
                },
            },
            { upsert: true }
        );
        sort += 1;
    }

    const methods = await PaymentMethodModel.find({
        isActive: true,
        $or: [{ reducesCash: true }, { isCashTaken: true }],
    }).sort({ sortOrder: 1 });

    for (const method of methods) {
        await DailyPaymentCollection.updateOne(
            { dailyAccountId: accountDoc._id, paymentMethodId: method._id },
            { $setOnInsert: { amountPaise: 0 } },
            { upsert: true }
        );
    }

    await writeAudit({
        entityType: "daily_account",
        entityId: account.id,
        action: "create",
        userId,
        details: { accountDate: date },
    });

    return account;
}

async function loadReadings(dailyAccountId) {
    const readings = await FuelMeterReading.find({ dailyAccountId }).sort({ sortOrder: 1 }).lean();
    const productIds = [...new Set(readings.map((row) => row.productId).filter(Boolean))];
    const products = await FuelProductModel.find({
        _id: { $in: productIds },
        isActive: true,
    }).lean();
    const productsById = byIdMap(products);

    return readings
        .filter((row) => productsById.has(toId(row.productId)))
        .sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            const nameA = productsById.get(toId(a.productId))?.name || "";
            const nameB = productsById.get(toId(b.productId))?.name || "";
            return nameA.localeCompare(nameB);
        })
        .map((row) => mapReading(row, productsById.get(toId(row.productId))));
}

async function loadCollections(dailyAccountId) {
    const collections = await DailyPaymentCollection.find({ dailyAccountId }).lean();
    const methodIds = collections.map((row) => row.paymentMethodId).filter(Boolean);
    const methods = await PaymentMethodModel.find({
        _id: { $in: methodIds },
        isActive: true,
    })
        .sort({ sortOrder: 1 })
        .lean();
    const methodsById = byIdMap(methods);

    return methods.map((method) => {
        const row = collections.find((item) => toId(item.paymentMethodId) === toId(method._id));
        return {
            id: toId(row?._id),
            paymentMethodId: toId(method._id),
            name: method.name,
            code: method.code,
            methodType: method.methodType,
            reducesCash: method.reducesCash,
            isCashTaken: method.isCashTaken,
            amountPaise: Number(row?.amountPaise || 0),
        };
    });
}

async function syncActivePaymentCollections(dailyAccountId) {
    const methods = await PaymentMethodModel.find({
        isActive: true,
        $or: [{ reducesCash: true }, { isCashTaken: true }],
    }).sort({ sortOrder: 1 });

    for (const method of methods) {
        await DailyPaymentCollection.updateOne(
            { dailyAccountId, paymentMethodId: method._id },
            { $setOnInsert: { amountPaise: 0 } },
            { upsert: true }
        );
    }

    const inactive = await PaymentMethodModel.find({ isActive: false }).select("_id");
    if (inactive.length) {
        await DailyPaymentCollection.deleteMany({
            dailyAccountId,
            paymentMethodId: { $in: inactive.map((method) => method._id) },
        });
    }
}

async function loadExpenses(dailyAccountId) {
    const expenses = await Expense.find({ dailyAccountId }).sort({ createdAt: 1 }).lean();
    const categoryIds = expenses.map((row) => row.categoryId).filter(Boolean);
    const methodIds = expenses.map((row) => row.paymentMethodId).filter(Boolean);
    const [categories, methods] = await Promise.all([
        categoryIds.length
            ? ExpenseCategoryModel.find({ _id: { $in: categoryIds } }).lean()
            : [],
        methodIds.length ? PaymentMethodModel.find({ _id: { $in: methodIds } }).lean() : [],
    ]);
    const categoriesById = byIdMap(categories);
    const methodsById = byIdMap(methods);

    return expenses.map((row) =>
        mapExpense(row, categoriesById.get(toId(row.categoryId)), methodsById.get(toId(row.paymentMethodId)))
    );
}

async function loadTransactions(dailyAccountId, filters = {}) {
    const query = { dailyAccountId };

    if (filters.type) {
        query.type = String(filters.type).toUpperCase();
    }
    if (filters.category) {
        query.category = { $regex: `^${escapeRegex(filters.category)}$`, $options: "i" };
    }
    if (filters.partyType) {
        query.partyType = filters.partyType;
    }
    if (filters.partyId && isValidObjectId(filters.partyId)) {
        query.partyId = filters.partyId;
    }
    if (filters.paymentMethodId && isValidObjectId(filters.paymentMethodId)) {
        query.paymentMethodId = filters.paymentMethodId;
    }
    if (filters.search) {
        const pattern = escapeRegex(filters.search);
        query.$or = [
            { description: { $regex: pattern, $options: "i" } },
            { notes: { $regex: pattern, $options: "i" } },
            { referenceNumber: { $regex: pattern, $options: "i" } },
        ];
    }
    if (filters.minAmountPaise !== undefined && filters.minAmountPaise !== "") {
        query.amountPaise = { ...(query.amountPaise || {}), $gte: Number(filters.minAmountPaise) };
    }
    if (filters.maxAmountPaise !== undefined && filters.maxAmountPaise !== "") {
        query.amountPaise = { ...(query.amountPaise || {}), $lte: Number(filters.maxAmountPaise) };
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const sort =
        filters.sort === "amount"
            ? { amountPaise: -1 }
            : filters.sort === "type"
              ? { type: 1, createdAt: 1 }
              : { txnDate: 1, txnTime: 1, createdAt: 1 };

    const [total, rows] = await Promise.all([
        LedgerTransaction.countDocuments(query),
        LedgerTransaction.find(query).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    const methodIds = rows.map((row) => row.paymentMethodId).filter(Boolean);
    const customerIds = rows
        .filter((row) => row.partyType === "customer" && row.partyId)
        .map((row) => row.partyId);
    const vendorIds = rows
        .filter((row) => row.partyType === "vendor" && row.partyId)
        .map((row) => row.partyId);

    const [methods, customers, vendors] = await Promise.all([
        methodIds.length ? PaymentMethodModel.find({ _id: { $in: methodIds } }).lean() : [],
        customerIds.length ? CustomerModel.find({ _id: { $in: customerIds } }).lean() : [],
        vendorIds.length ? VendorModel.find({ _id: { $in: vendorIds } }).lean() : [],
    ]);
    const methodsById = byIdMap(methods);
    const customersById = byIdMap(customers);
    const vendorsById = byIdMap(vendors);

    const mapped = rows.map((row) => {
        let partyName = null;
        if (row.partyType === "customer") {
            partyName = customersById.get(toId(row.partyId))?.name || null;
        } else if (row.partyType === "vendor") {
            partyName = vendorsById.get(toId(row.partyId))?.name || null;
        }
        return mapTxn(row, methodsById.get(toId(row.paymentMethodId)), partyName);
    });

    return {
        items: calculateLedgerRunningBalance(mapped),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
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

    const collectionsForCash = collections.map((row) => {
        const isCredit =
            String(row.methodType || "").toLowerCase() === "credit" ||
            String(row.code || "").toLowerCase() === "credit";
        return isCredit ? { ...row, amountPaise: totalCreditPaise } : row;
    });

    const cashSummary = calculateCashSummary({
        totalFuelSalePaise,
        collections: collectionsForCash,
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
        const updated = await DailyAccount.findByIdAndUpdate(
            account.id,
            { cashTakenPaise },
            { new: true }
        );
        await writeAudit({
            entityType: "daily_account",
            entityId: account.id,
            action: "update_cash_taken",
            userId,
            details: { cashTakenPaise },
        });
        return buildDayPayload(mapDaily(updated));
    },

    async upsertCollection(accountDate, userId, { paymentMethodId, amountRupees }) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        if (!paymentMethodId) throw new ApiError(400, "Payment method is required");
        if (!isValidObjectId(paymentMethodId)) throw new ApiError(400, "Invalid payment method");
        const amountPaise = toPaise(amountRupees);
        if (amountPaise < 0) throw new ApiError(400, "Amount cannot be negative");

        await DailyPaymentCollection.findOneAndUpdate(
            { dailyAccountId: account.id, paymentMethodId },
            { amountPaise },
            { upsert: true, new: true, setDefaultsOnInsert: true }
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
        if (!isValidObjectId(readingId)) throw new ApiError(404, "Meter reading not found");

        const existing = await FuelMeterReading.findOne({
            _id: readingId,
            dailyAccountId: account.id,
        });
        if (!existing) throw new ApiError(404, "Meter reading not found");

        const newReading =
            payload.newReading !== undefined
                ? parseLitres(payload.newReading)
                : Number(existing.newReading);
        const oldReading =
            payload.oldReading !== undefined
                ? parseLitres(payload.oldReading)
                : Number(existing.oldReading);
        const testingLitres =
            payload.testingLitres !== undefined
                ? parseLitres(payload.testingLitres)
                : Number(existing.testingLitres);
        const ratePaise =
            payload.rateRupees !== undefined
                ? toPaise(payload.rateRupees)
                : Number(existing.ratePaise);

        if (newReading < oldReading) {
            throw new ApiError(400, "New reading cannot be less than old reading");
        }

        const litres = calcLitres(newReading, oldReading);
        const netLitres = calcNetLitres(litres, testingLitres);
        if (netLitres < 0) {
            throw new ApiError(400, "Testing litres cannot exceed LTR");
        }
        const totalSalePaise = calcFuelSalePaise(netLitres, ratePaise);

        existing.newReading = newReading;
        existing.oldReading = oldReading;
        existing.litres = litres;
        existing.testingLitres = testingLitres;
        existing.netLitres = netLitres;
        existing.ratePaise = ratePaise;
        existing.totalSalePaise = totalSalePaise;
        if (payload.meterLabel !== undefined && payload.meterLabel !== null) {
            existing.meterLabel = payload.meterLabel;
        }
        await existing.save();

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
        if (!isValidObjectId(productId)) throw new ApiError(404, "Product not found");

        const product = await FuelProductModel.findById(productId);
        if (!product) throw new ApiError(404, "Product not found");

        const oldReading = await getPreviousProductReading(productId, account.accountDate);
        const last = await FuelMeterReading.findOne({ dailyAccountId: account.id })
            .sort({ sortOrder: -1 })
            .select("sortOrder")
            .lean();

        await FuelMeterReading.create({
            dailyAccountId: account.id,
            productId,
            meterLabel: product.name,
            newReading: oldReading,
            oldReading,
            litres: 0,
            testingLitres: 0,
            netLitres: 0,
            ratePaise: Number(product.currentRatePaise),
            totalSalePaise: 0,
            sortOrder: (last?.sortOrder || 0) + 1,
        });

        return buildDayPayload(account);
    },

    async addExpense(accountDate, userId, payload) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);

        const amountPaise = toPaise(payload.amountRupees);
        if (amountPaise <= 0) throw new ApiError(400, "Amount must be greater than 0");
        if (!payload.description?.trim()) throw new ApiError(400, "Description is required");

        await Expense.create({
            dailyAccountId: account.id,
            categoryId: isValidObjectId(payload.categoryId) ? payload.categoryId : null,
            description: payload.description.trim(),
            amountPaise,
            paymentMethodId: isValidObjectId(payload.paymentMethodId)
                ? payload.paymentMethodId
                : null,
            notes: payload.notes || null,
            createdBy: isValidObjectId(userId) ? userId : null,
        });

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
        if (!isValidObjectId(expenseId)) throw new ApiError(404, "Expense not found");
        const result = await Expense.findOneAndDelete({
            _id: expenseId,
            dailyAccountId: account.id,
        });
        if (!result) throw new ApiError(404, "Expense not found");
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
            const created = await LedgerTransaction.create({
                dailyAccountId: account.id,
                type,
                txnDate,
                txnTime: payload.time || null,
                description: personName,
                partyType: payload.partyType || "other",
                partyId: isValidObjectId(payload.partyId) ? payload.partyId : null,
                category,
                paymentMethodId: isValidObjectId(payload.paymentMethodId)
                    ? payload.paymentMethodId
                    : null,
                amountPaise,
                referenceNumber: payload.referenceNumber || null,
                notes: payload.notes || null,
                ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
                createdBy: isValidObjectId(userId) ? userId : null,
            });

            await writeAudit({
                entityType: "ledger_transaction",
                entityId: created._id,
                action: "create",
                userId,
                details: { type, amountPaise },
            });
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ApiError(409, "Duplicate transaction submission");
            }
            throw error;
        }

        return buildDayPayload(account);
    },

    async deleteTransaction(accountDate, userId, transactionId) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        if (!isValidObjectId(transactionId)) throw new ApiError(404, "Transaction not found");
        const result = await LedgerTransaction.findOneAndDelete({
            _id: transactionId,
            dailyAccountId: account.id,
        });
        if (!result) throw new ApiError(404, "Transaction not found");
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

        const updated = await DailyAccount.findByIdAndUpdate(
            account.id,
            {
                status: "closed",
                actualClosingCashPaise,
                closedAt: new Date(),
                closedBy: isValidObjectId(userId) ? userId : null,
            },
            { new: true }
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

        return buildDayPayload(mapDaily(updated));
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

        const updated = await DailyAccount.findByIdAndUpdate(
            account.id,
            {
                status: "open",
                reopenedAt: new Date(),
                reopenedBy: isValidObjectId(userId) ? userId : null,
            },
            { new: true }
        );

        await writeAudit({
            entityType: "daily_account",
            entityId: account.id,
            action: "reopen",
            userId,
        });

        return buildDayPayload(mapDaily(updated));
    },

    async listLedgerNames({ type, search } = {}) {
        const filter = { description: { $nin: [null, ""] } };

        if (type && ["DEBIT", "CREDIT"].includes(String(type).toUpperCase())) {
            filter.type = String(type).toUpperCase();
        }
        if (search?.trim()) {
            filter.description = { $regex: escapeRegex(search.trim()), $options: "i" };
        }

        const partyFilter = search?.trim()
            ? { name: { $regex: escapeRegex(search.trim()), $options: "i" } }
            : {};

        const [ledgerNames, customers, vendors] = await Promise.all([
            LedgerTransaction.distinct("description", filter),
            CustomerModel.find(partyFilter).select("name").limit(50).lean(),
            VendorModel.find(partyFilter).select("name").limit(50).lean(),
        ]);

        const seen = new Set();
        const names = [];
        for (const value of [...ledgerNames, ...customers.map((row) => row.name), ...vendors.map((row) => row.name)]) {
            const name = String(value || "").trim();
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
        const [row] = await LedgerTransaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalCreditPaise: {
                        $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amountPaise", 0] },
                    },
                    totalDebitPaise: {
                        $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amountPaise", 0] },
                    },
                },
            },
        ]);

        const totalCreditPaise = Number(row?.totalCreditPaise || 0);
        const totalDebitPaise = Number(row?.totalDebitPaise || 0);
        return {
            totalCreditPaise,
            totalDebitPaise,
            totalUdhaarPaise: totalCreditPaise - totalDebitPaise,
        };
    },
};
