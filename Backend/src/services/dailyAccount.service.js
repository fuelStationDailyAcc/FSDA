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

function isCreditMethod(row) {
    return (
        String(row.methodType || "").toLowerCase() === "credit" ||
        String(row.code || "").toLowerCase() === "credit"
    );
}

function collectionsWithLedgerCredit(collections, totalCreditPaise) {
    return [
        ...collections.filter((row) => !isCreditMethod(row)),
        {
            methodType: "credit",
            code: "credit",
            reducesCash: true,
            isCashTaken: false,
            amountPaise: Number(totalCreditPaise || 0),
        },
    ];
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
    const collections = await DailyPaymentCollection.find({ dailyAccountId })
        .sort({ createdAt: 1 })
        .lean();
    const methodIds = collections.map((row) => row.paymentMethodId).filter(Boolean);
    const methods = await PaymentMethodModel.find({ _id: { $in: methodIds } }).lean();
    const methodsById = byIdMap(methods);

    return collections
        .map((row) => {
            const method = methodsById.get(toId(row.paymentMethodId));
            if (!method) return null;
            return {
                id: toId(row._id),
                paymentMethodId: toId(method._id),
                name: method.name,
                code: method.code,
                methodType: method.methodType,
                reducesCash: method.reducesCash,
                isCashTaken: method.isCashTaken,
                description: row.description || "",
                amountPaise: Number(row.amountPaise || 0),
            };
        })
        .filter(Boolean);
}

async function syncActivePaymentCollections(dailyAccountId) {
    await DailyPaymentCollection.deleteMany({
        dailyAccountId,
        amountPaise: 0,
        $or: [{ description: null }, { description: "" }, { description: { $exists: false } }],
    });
}

async function syncActiveProductReadings(dailyAccountId, accountDate) {
    const products = await FuelProductModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    const existing = await FuelMeterReading.find({ dailyAccountId }).lean();
    const existingProductIds = new Set(existing.map((row) => toId(row.productId)));
    let sort = existing.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), -1);
    const productsById = byIdMap(products);

    for (const product of products) {
        if (existingProductIds.has(toId(product._id))) continue;

        const oldReading = await getPreviousProductReading(product._id, accountDate);
        sort += 1;
        await FuelMeterReading.updateOne(
            { dailyAccountId, productId: product._id, meterLabel: product.name },
            {
                $setOnInsert: {
                    newReading: oldReading,
                    oldReading,
                    litres: 0,
                    testingLitres: 0,
                    netLitres: 0,
                    ratePaise: Number(product.currentRatePaise),
                    totalSalePaise: 0,
                    sortOrder: Number(product.sortOrder) || sort,
                },
            },
            { upsert: true }
        );
    }

    for (const row of existing) {
        const product = productsById.get(toId(row.productId));
        if (!product) continue;
        const unused =
            Number(row.litres || 0) === 0 &&
            Number(row.testingLitres || 0) === 0 &&
            Number(row.totalSalePaise || 0) === 0;
        if (!unused) continue;
        const ratePaise = Number(product.currentRatePaise);
        if (Number(row.ratePaise) === ratePaise && row.meterLabel === product.name) continue;
        await FuelMeterReading.updateOne(
            { _id: row._id },
            { $set: { ratePaise, meterLabel: product.name } }
        );
    }

    const inactive = await FuelProductModel.find({ isActive: false }).select("_id");
    if (inactive.length) {
        await FuelMeterReading.deleteMany({
            dailyAccountId,
            productId: { $in: inactive.map((product) => product._id) },
            litres: 0,
            testingLitres: 0,
            netLitres: 0,
            totalSalePaise: 0,
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
    if (account.status !== "closed") {
        await syncActiveProductReadings(account.id, account.accountDate);
    }
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

    const collectionsForCash = collectionsWithLedgerCredit(collections, totalCreditPaise);

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

    async listHistory({ from, to, status } = {}) {
        const match = {};
        if (from || to) {
            match.accountDate = {};
            if (from) match.accountDate.$gte = normalizeDate(from);
            if (to) match.accountDate.$lte = normalizeDate(to);
        }
        if (status === "open" || status === "closed") match.status = status;

        const accounts = await DailyAccount.find(match).sort({ accountDate: -1 }).lean();
        if (!accounts.length) return [];

        const ids = accounts.map((row) => row._id);

        const [saleRows, expenseRows, ledgerRows, collectionRows] = await Promise.all([
            FuelMeterReading.aggregate([
                { $match: { dailyAccountId: { $in: ids } } },
                {
                    $group: {
                        _id: "$dailyAccountId",
                        totalFuelSalesPaise: { $sum: "$totalSalePaise" },
                    },
                },
            ]),
            Expense.aggregate([
                { $match: { dailyAccountId: { $in: ids } } },
                {
                    $group: {
                        _id: "$dailyAccountId",
                        totalExpensesPaise: { $sum: "$amountPaise" },
                    },
                },
            ]),
            LedgerTransaction.aggregate([
                { $match: { dailyAccountId: { $in: ids } } },
                {
                    $group: {
                        _id: { dailyAccountId: "$dailyAccountId", type: "$type" },
                        totalPaise: { $sum: "$amountPaise" },
                    },
                },
            ]),
            DailyPaymentCollection.aggregate([
                { $match: { dailyAccountId: { $in: ids } } },
                {
                    $lookup: {
                        from: "payment_methods",
                        localField: "paymentMethodId",
                        foreignField: "_id",
                        as: "method",
                    },
                },
                { $unwind: { path: "$method", preserveNullAndEmptyArrays: true } },
            ]),
        ]);

        const salesById = new Map(
            saleRows.map((row) => [toId(row._id), Number(row.totalFuelSalesPaise || 0)])
        );
        const expensesById = new Map(
            expenseRows.map((row) => [toId(row._id), Number(row.totalExpensesPaise || 0)])
        );
        const creditById = new Map();
        const debitById = new Map();
        for (const row of ledgerRows) {
            const id = toId(row._id.dailyAccountId);
            if (row._id.type === "CREDIT") creditById.set(id, Number(row.totalPaise || 0));
            else debitById.set(id, Number(row.totalPaise || 0));
        }

        const collectionsById = new Map();
        for (const row of collectionRows) {
            const id = toId(row.dailyAccountId);
            if (!collectionsById.has(id)) collectionsById.set(id, []);
            collectionsById.get(id).push({
                paymentMethodId: toId(row.paymentMethodId),
                name: row.method?.name,
                methodType: row.method?.methodType,
                code: row.method?.code,
                reducesCash: row.method?.reducesCash,
                isCashTaken: row.method?.isCashTaken,
                amountPaise: Number(row.amountPaise || 0),
            });
        }

        return accounts.map((doc) => {
            const account = mapDaily(doc);
            const id = account.id;
            const totalFuelSalePaise = salesById.get(id) || 0;
            const totalExpensePaise = expensesById.get(id) || 0;
            const totalCreditPaise = creditById.get(id) || 0;
            const totalDebitPaise = debitById.get(id) || 0;
            const collections = collectionsWithLedgerCredit(
                collectionsById.get(id) || [],
                totalCreditPaise
            );
            const cashSummary = calculateCashSummary({
                totalFuelSalePaise,
                collections,
                totalExpensePaise,
                cashTakenPaise: account.cashTakenPaise,
                actualClosingCashPaise: account.actualClosingCashPaise,
            });

            return {
                id,
                accountDate: account.accountDate,
                status: account.status,
                closedAt: account.closedAt,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
                totalFuelSalesPaise: totalFuelSalePaise,
                totalCreditPaise: cashSummary.creditPaise,
                totalDebitPaise,
                totalExpensesPaise: totalExpensePaise,
                onlineCollectionsPaise: cashSummary.onlinePaise + cashSummary.otherNonCashPaise,
                closingCashPaise: cashSummary.expectedClosingCashPaise,
                actualClosingCashPaise: cashSummary.actualClosingCashPaise,
                differencePaise: cashSummary.differencePaise,
            };
        });
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

    async addCollection(accountDate, userId, { paymentMethodId, amountRupees, description }) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        if (!paymentMethodId) throw new ApiError(400, "Payment method is required");
        if (!isValidObjectId(paymentMethodId)) throw new ApiError(400, "Invalid payment method");
        const method = await PaymentMethodModel.findById(paymentMethodId);
        if (!method || !method.isActive) throw new ApiError(400, "Payment method not found");
        const amountPaise = toPaise(amountRupees);
        if (amountPaise <= 0) throw new ApiError(400, "Amount must be greater than 0");

        const created = await DailyPaymentCollection.create({
            dailyAccountId: account.id,
            paymentMethodId,
            amountPaise,
            description: String(description || "").trim(),
        });

        await writeAudit({
            entityType: "daily_payment_collection",
            entityId: created._id,
            action: "create",
            userId,
            details: { paymentMethodId, amountPaise, description: created.description },
        });

        return buildDayPayload(account);
    },

    async deleteCollection(accountDate, userId, collectionId) {
        const account = await ensureDailyAccount(accountDate, userId);
        assertOpen(account);
        if (!isValidObjectId(collectionId)) throw new ApiError(404, "Collection not found");
        const result = await DailyPaymentCollection.findOneAndDelete({
            _id: collectionId,
            dailyAccountId: account.id,
        });
        if (!result) throw new ApiError(404, "Collection not found");
        await writeAudit({
            entityType: "daily_payment_collection",
            entityId: collectionId,
            action: "delete",
            userId,
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
        const ratePaise = Number(existing.ratePaise);

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
