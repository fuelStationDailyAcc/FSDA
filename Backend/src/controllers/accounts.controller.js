import { DailyAccountService } from "../services/dailyAccount.service.js";
import { FuelProduct } from "../models/fuelProduct.model.js";
import { PaymentMethod } from "../models/paymentMethod.model.js";
import { ExpenseCategory, TransactionCategory } from "../models/catalog.model.js";
import { Customer, Vendor } from "../models/party.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toPaise } from "../services/money.js";

export const getDailyAccount = asyncHandler(async (req, res) => {
    const { date, ...filters } = req.query;
    const data = await DailyAccountService.getByDate(date, req.user._id, filters);
    return res.status(200).json(new ApiResponse(200, data, "Daily account fetched"));
});

export const listDailyAccounts = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.listHistory({
        from: req.query.from,
        to: req.query.to,
        status: req.query.status,
    });
    return res.status(200).json(new ApiResponse(200, data, "Daily accounts fetched"));
});

export const updateCashTaken = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.updateCashTaken(
        req.body.date,
        req.user._id,
        req.body.cashTakenRupees
    );
    return res.status(200).json(new ApiResponse(200, data, "Cash taken updated"));
});

export const upsertCollection = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.upsertCollection(req.body.date, req.user._id, req.body);
    return res.status(200).json(new ApiResponse(200, data, "Collection updated"));
});

export const updateReading = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.updateReading(
        req.body.date,
        req.user._id,
        req.params.id,
        req.body
    );
    return res.status(200).json(new ApiResponse(200, data, "Meter reading updated"));
});

export const addReading = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addReading(req.body.date, req.user._id, req.body);
    return res.status(201).json(new ApiResponse(201, data, "Meter reading added"));
});

export const addExpense = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addExpense(req.body.date, req.user._id, req.body);
    return res.status(201).json(new ApiResponse(201, data, "Expense added"));
});

export const deleteExpense = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.deleteExpense(
        req.query.date || req.body.date,
        req.user._id,
        req.params.id
    );
    return res.status(200).json(new ApiResponse(200, data, "Expense deleted"));
});

export const addTransaction = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addTransaction(req.body.date, req.user._id, {
        ...req.body,
        idempotencyKey: req.header("Idempotency-Key") || req.body.idempotencyKey,
    });
    return res.status(201).json(new ApiResponse(201, data, "Transaction saved"));
});

export const deleteTransaction = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.deleteTransaction(
        req.query.date || req.body.date,
        req.user._id,
        req.params.id
    );
    return res.status(200).json(new ApiResponse(200, data, "Transaction deleted"));
});

export const closeDay = asyncHandler(async (req, res) => {
    if (req.body.actualClosingCashRupees === undefined || req.body.actualClosingCashRupees === "") {
        throw new ApiError(400, "Actual closing cash is required");
    }
    const data = await DailyAccountService.closeDay(req.body.date, req.user._id, req.body);
    return res.status(200).json(new ApiResponse(200, data, "Day closed successfully"));
});

export const reopenDay = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.reopenDay(
        req.body.date,
        req.user._id,
        req.user.role
    );
    return res.status(200).json(new ApiResponse(200, data, "Day reopened"));
});

export const listProducts = asyncHandler(async (req, res) => {
    const data = await FuelProduct.list({ activeOnly: req.query.activeOnly === "true" });
    return res.status(200).json(new ApiResponse(200, data, "Products fetched"));
});

export const createProduct = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Product name is required");
    const data = await FuelProduct.create({
        name: req.body.name,
        productType: req.body.productType,
        currentRatePaise: toPaise(req.body.currentRateRupees),
        sortOrder: req.body.sortOrder,
    });
    return res.status(201).json(new ApiResponse(201, data, "Product created"));
});

export const updateProduct = asyncHandler(async (req, res) => {
    const data = await FuelProduct.update(req.params.id, {
        name: req.body.name,
        productType: req.body.productType,
        currentRatePaise:
            req.body.currentRateRupees === undefined
                ? undefined
                : toPaise(req.body.currentRateRupees),
        isActive: req.body.isActive,
        sortOrder: req.body.sortOrder,
    });
    if (!data) throw new ApiError(404, "Product not found");
    return res.status(200).json(new ApiResponse(200, data, "Product updated"));
});

export const deleteProduct = asyncHandler(async (req, res) => {
    const data = await FuelProduct.delete(req.params.id);
    if (!data) throw new ApiError(404, "Product not found");
    const message = data.deactivated
        ? "Product hidden from new days. Past meter readings were kept."
        : "Product removed";
    return res.status(200).json(new ApiResponse(200, data, message));
});

export const listPaymentMethods = asyncHandler(async (req, res) => {
    const data = await PaymentMethod.list({ activeOnly: req.query.activeOnly === "true" });
    return res.status(200).json(new ApiResponse(200, data, "Payment methods fetched"));
});

export const createPaymentMethod = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim() || !req.body.code?.trim()) {
        throw new ApiError(400, "Name and code are required");
    }
    const data = await PaymentMethod.create(req.body);
    return res.status(201).json(new ApiResponse(201, data, "Payment method created"));
});

export const updatePaymentMethod = asyncHandler(async (req, res) => {
    const data = await PaymentMethod.update(req.params.id, req.body);
    if (!data) throw new ApiError(404, "Payment method not found");
    return res.status(200).json(new ApiResponse(200, data, "Payment method updated"));
});

export const deletePaymentMethod = asyncHandler(async (req, res) => {
    const data = await PaymentMethod.delete(req.params.id);
    if (!data) throw new ApiError(404, "Payment method not found");
    return res.status(200).json(new ApiResponse(200, data, "Payment method removed"));
});

export const listExpenseCategories = asyncHandler(async (req, res) => {
    const data = await ExpenseCategory.list({ activeOnly: req.query.activeOnly === "true" });
    return res.status(200).json(new ApiResponse(200, data, "Expense categories fetched"));
});

export const createExpenseCategory = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Name is required");
    const data = await ExpenseCategory.create(req.body);
    return res.status(201).json(new ApiResponse(201, data, "Expense category created"));
});

export const updateExpenseCategory = asyncHandler(async (req, res) => {
    const data = await ExpenseCategory.update(req.params.id, req.body);
    if (!data) throw new ApiError(404, "Expense category not found");
    return res.status(200).json(new ApiResponse(200, data, "Expense category updated"));
});

export const deleteExpenseCategory = asyncHandler(async (req, res) => {
    const data = await ExpenseCategory.delete(req.params.id);
    if (!data) throw new ApiError(404, "Expense category not found");
    return res.status(200).json(new ApiResponse(200, data, "Expense category removed"));
});

export const listTxnCategories = asyncHandler(async (req, res) => {
    const data = await TransactionCategory.list({ activeOnly: true });
    return res.status(200).json(new ApiResponse(200, data, "Transaction categories fetched"));
});

export const listLedgerNames = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.listLedgerNames({
        type: req.query.type,
        search: req.query.search,
    });
    return res.status(200).json(new ApiResponse(200, data, "Ledger names fetched"));
});

export const getLedgerTotals = asyncHandler(async (_req, res) => {
    const data = await DailyAccountService.getLedgerTotals();
    return res.status(200).json(new ApiResponse(200, data, "Ledger totals fetched"));
});

export const listCustomers = asyncHandler(async (req, res) => {
    const data = await Customer.list();
    return res.status(200).json(new ApiResponse(200, data, "Customers fetched"));
});

export const createCustomer = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Customer name is required");
    const data = await Customer.create(req.body);
    return res.status(201).json(new ApiResponse(201, data, "Customer created"));
});

export const updateCustomer = asyncHandler(async (req, res) => {
    const data = await Customer.update(req.params.id, req.body);
    if (!data) throw new ApiError(404, "Customer not found");
    return res.status(200).json(new ApiResponse(200, data, "Customer updated"));
});

export const deleteCustomer = asyncHandler(async (req, res) => {
    const data = await Customer.delete(req.params.id);
    if (!data) throw new ApiError(404, "Customer not found");
    return res.status(200).json(new ApiResponse(200, data, "Customer deleted"));
});

export const listVendors = asyncHandler(async (req, res) => {
    const data = await Vendor.list();
    return res.status(200).json(new ApiResponse(200, data, "Vendors fetched"));
});

export const createVendor = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Vendor name is required");
    const data = await Vendor.create(req.body);
    return res.status(201).json(new ApiResponse(201, data, "Vendor created"));
});

export const updateVendor = asyncHandler(async (req, res) => {
    const data = await Vendor.update(req.params.id, req.body);
    if (!data) throw new ApiError(404, "Vendor not found");
    return res.status(200).json(new ApiResponse(200, data, "Vendor updated"));
});
