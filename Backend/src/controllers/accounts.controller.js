import { DailyAccountService } from "../services/dailyAccount.service.js";
import { FuelProduct } from "../models/fuelProduct.model.js";
import { PaymentMethod } from "../models/paymentMethod.model.js";
import { ExpenseCategory, TransactionCategory } from "../models/catalog.model.js";
import { Customer, Vendor } from "../models/party.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toPaise } from "../services/money.js";
import { requireStationOwnerId } from "../utils/tenant.js";

export const getDailyAccount = asyncHandler(async (req, res) => {
    const { date, ...filters } = req.query;
    const data = await DailyAccountService.getByDate(
        date,
        req.user._id,
        requireStationOwnerId(req.user),
        filters
    );
    return res.status(200).json(new ApiResponse(200, data, "Daily account fetched"));
});

export const listDailyAccounts = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.listHistory({
        ownerId: requireStationOwnerId(req.user),
        from: req.query.from,
        to: req.query.to,
        status: req.query.status,
    });
    return res.status(200).json(new ApiResponse(200, data, "Daily accounts fetched"));
});

export const getProfitAnalytics = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.getProfitAnalytics({
        ownerId: requireStationOwnerId(req.user),
        from: req.query.from,
        to: req.query.to,
    });
    return res.status(200).json(new ApiResponse(200, data, "Profit analytics fetched"));
});

export const updateCashTaken = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.updateCashTaken(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.body.cashTakenRupees
    );
    return res.status(200).json(new ApiResponse(200, data, "Cash taken updated"));
});

export const addCollection = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addCollection(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.body
    );
    return res.status(201).json(new ApiResponse(201, data, "Collection added"));
});

export const deleteCollection = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.deleteCollection(
        req.query.date || req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.params.id
    );
    return res.status(200).json(new ApiResponse(200, data, "Collection deleted"));
});

export const updateReading = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.updateReading(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.params.id,
        req.body
    );
    return res.status(200).json(new ApiResponse(200, data, "Meter reading updated"));
});

export const addReading = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addReading(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.body
    );
    return res.status(201).json(new ApiResponse(201, data, "Meter reading added"));
});

export const addExpense = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addExpense(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.body
    );
    return res.status(201).json(new ApiResponse(201, data, "Expense added"));
});

export const deleteExpense = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.deleteExpense(
        req.query.date || req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.params.id
    );
    return res.status(200).json(new ApiResponse(200, data, "Expense deleted"));
});

export const addTransaction = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.addTransaction(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        {
            ...req.body,
            idempotencyKey: req.header("Idempotency-Key") || req.body.idempotencyKey,
        }
    );
    return res.status(201).json(new ApiResponse(201, data, "Transaction saved"));
});

export const deleteTransaction = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.deleteTransaction(
        req.query.date || req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.params.id
    );
    return res.status(200).json(new ApiResponse(200, data, "Transaction deleted"));
});

export const closeDay = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.closeDay(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.body
    );
    return res.status(200).json(new ApiResponse(200, data, "Day closed successfully"));
});

export const reopenDay = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.reopenDay(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user),
        req.user.role
    );
    return res.status(200).json(new ApiResponse(200, data, "Day reopened"));
});

export const resetDay = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.resetDay(
        req.body.date,
        req.user._id,
        requireStationOwnerId(req.user)
    );
    return res.status(200).json(new ApiResponse(200, data, "Day reset to zero"));
});

export const deleteDay = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.deleteDay(
        req.query.date || req.body.date,
        req.user._id,
        requireStationOwnerId(req.user)
    );
    return res.status(200).json(new ApiResponse(200, data, "Daily account deleted"));
});

export const listProducts = asyncHandler(async (req, res) => {
    const data = await FuelProduct.list(requireStationOwnerId(req.user), {
        activeOnly: req.query.activeOnly === "true",
    });
    return res.status(200).json(new ApiResponse(200, data, "Products fetched"));
});

export const createProduct = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Product name is required");
    const data = await FuelProduct.create(requireStationOwnerId(req.user), {
        name: req.body.name,
        productType: req.body.productType,
        currentRatePaise: toPaise(req.body.currentRateRupees),
        profitPaise: toPaise(req.body.profitRupees),
        sortOrder: req.body.sortOrder,
    });
    return res.status(201).json(new ApiResponse(201, data, "Product created"));
});

export const updateProduct = asyncHandler(async (req, res) => {
    const data = await FuelProduct.update(req.params.id, requireStationOwnerId(req.user), {
        name: req.body.name,
        productType: req.body.productType,
        currentRatePaise:
            req.body.currentRateRupees === undefined
                ? undefined
                : toPaise(req.body.currentRateRupees),
        profitPaise:
            req.body.profitRupees === undefined ? undefined : toPaise(req.body.profitRupees),
        isActive: req.body.isActive,
        sortOrder: req.body.sortOrder,
    });
    if (!data) throw new ApiError(404, "Product not found");
    return res.status(200).json(new ApiResponse(200, data, "Product updated"));
});

export const deleteProduct = asyncHandler(async (req, res) => {
    const data = await FuelProduct.delete(req.params.id, requireStationOwnerId(req.user));
    if (!data) throw new ApiError(404, "Product not found");
    const message = data.deactivated
        ? "Product hidden from new days. Past meter readings were kept."
        : "Product removed";
    return res.status(200).json(new ApiResponse(200, data, message));
});

export const listPaymentMethods = asyncHandler(async (req, res) => {
    const data = await PaymentMethod.list(requireStationOwnerId(req.user), {
        activeOnly: req.query.activeOnly === "true",
    });
    return res.status(200).json(new ApiResponse(200, data, "Payment methods fetched"));
});

export const createPaymentMethod = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim() || !req.body.code?.trim()) {
        throw new ApiError(400, "Name and code are required");
    }
    const data = await PaymentMethod.create(requireStationOwnerId(req.user), req.body);
    return res.status(201).json(new ApiResponse(201, data, "Payment method created"));
});

export const updatePaymentMethod = asyncHandler(async (req, res) => {
    const data = await PaymentMethod.update(
        req.params.id,
        requireStationOwnerId(req.user),
        req.body
    );
    if (!data) throw new ApiError(404, "Payment method not found");
    return res.status(200).json(new ApiResponse(200, data, "Payment method updated"));
});

export const deletePaymentMethod = asyncHandler(async (req, res) => {
    const data = await PaymentMethod.delete(req.params.id, requireStationOwnerId(req.user));
    if (!data) throw new ApiError(404, "Payment method not found");
    return res.status(200).json(new ApiResponse(200, data, "Payment method removed"));
});

export const listExpenseCategories = asyncHandler(async (req, res) => {
    const data = await ExpenseCategory.list(requireStationOwnerId(req.user), {
        activeOnly: req.query.activeOnly === "true",
    });
    return res.status(200).json(new ApiResponse(200, data, "Expense categories fetched"));
});

export const createExpenseCategory = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Name is required");
    const data = await ExpenseCategory.create(requireStationOwnerId(req.user), req.body);
    return res.status(201).json(new ApiResponse(201, data, "Expense category created"));
});

export const updateExpenseCategory = asyncHandler(async (req, res) => {
    const data = await ExpenseCategory.update(
        req.params.id,
        requireStationOwnerId(req.user),
        req.body
    );
    if (!data) throw new ApiError(404, "Expense category not found");
    return res.status(200).json(new ApiResponse(200, data, "Expense category updated"));
});

export const deleteExpenseCategory = asyncHandler(async (req, res) => {
    const data = await ExpenseCategory.delete(req.params.id, requireStationOwnerId(req.user));
    if (!data) throw new ApiError(404, "Expense category not found");
    return res.status(200).json(new ApiResponse(200, data, "Expense category removed"));
});

export const listTxnCategories = asyncHandler(async (req, res) => {
    const data = await TransactionCategory.list(requireStationOwnerId(req.user), { activeOnly: true });
    return res.status(200).json(new ApiResponse(200, data, "Transaction categories fetched"));
});

export const listLedgerNames = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.listLedgerNames(requireStationOwnerId(req.user), {
        type: req.query.type,
        search: req.query.search,
    });
    return res.status(200).json(new ApiResponse(200, data, "Ledger names fetched"));
});

export const getLedgerTotals = asyncHandler(async (req, res) => {
    const data = await DailyAccountService.getLedgerTotals(requireStationOwnerId(req.user));
    return res.status(200).json(new ApiResponse(200, data, "Ledger totals fetched"));
});

export const listCustomers = asyncHandler(async (req, res) => {
    const data = await Customer.list(requireStationOwnerId(req.user));
    return res.status(200).json(new ApiResponse(200, data, "Customers fetched"));
});

export const createCustomer = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Customer name is required");
    const data = await Customer.create(requireStationOwnerId(req.user), req.body);
    return res.status(201).json(new ApiResponse(201, data, "Customer created"));
});

export const updateCustomer = asyncHandler(async (req, res) => {
    const data = await Customer.update(req.params.id, requireStationOwnerId(req.user), req.body);
    if (!data) throw new ApiError(404, "Customer not found");
    return res.status(200).json(new ApiResponse(200, data, "Customer updated"));
});

export const deleteCustomer = asyncHandler(async (req, res) => {
    const data = await Customer.delete(req.params.id, requireStationOwnerId(req.user));
    if (!data) throw new ApiError(404, "Customer not found");
    return res.status(200).json(new ApiResponse(200, data, "Customer deleted"));
});

export const listVendors = asyncHandler(async (req, res) => {
    const data = await Vendor.list(requireStationOwnerId(req.user));
    return res.status(200).json(new ApiResponse(200, data, "Vendors fetched"));
});

export const createVendor = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Vendor name is required");
    const data = await Vendor.create(requireStationOwnerId(req.user), req.body);
    return res.status(201).json(new ApiResponse(201, data, "Vendor created"));
});

export const updateVendor = asyncHandler(async (req, res) => {
    const data = await Vendor.update(req.params.id, requireStationOwnerId(req.user), req.body);
    if (!data) throw new ApiError(404, "Vendor not found");
    return res.status(200).json(new ApiResponse(200, data, "Vendor updated"));
});
