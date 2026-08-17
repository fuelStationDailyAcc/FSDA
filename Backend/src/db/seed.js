import { FuelProductModel } from "../models/fuelProduct.model.js";
import { PaymentMethodModel } from "../models/paymentMethod.model.js";
import { ExpenseCategoryModel, TransactionCategoryModel } from "../models/catalog.model.js";

const DEFAULT_PRODUCTS = [
    { name: "MS", productType: "MS", currentRatePaise: 10491, sortOrder: 1 },
    { name: "HSD", productType: "HSD", currentRatePaise: 9484, sortOrder: 2 },
    { name: "CNG", productType: "CNG", currentRatePaise: 0, sortOrder: 3 },
];

const DEFAULT_PAYMENT_METHODS = [
    { name: "Cash", code: "cash", methodType: "cash", reducesCash: false, isCashTaken: false, sortOrder: 1 },
    { name: "Credit", code: "credit", methodType: "credit", reducesCash: true, isCashTaken: false, sortOrder: 2 },
    { name: "Card", code: "card", methodType: "card", reducesCash: true, isCashTaken: false, sortOrder: 3 },
    { name: "Online Payment", code: "online_payments", methodType: "online", reducesCash: true, isCashTaken: false, sortOrder: 4 },
    { name: "Bank Payment", code: "bank", methodType: "bank", reducesCash: true, isCashTaken: false, sortOrder: 5 },
];

async function ensurePaymentMethods() {
    for (const method of DEFAULT_PAYMENT_METHODS) {
        const existing = await PaymentMethodModel.findOne({ code: method.code });
        if (!existing) {
            await PaymentMethodModel.create({ ...method, isActive: true });
            continue;
        }
        if (method.code === "online_payments" && existing.name === "Online Payments") {
            existing.name = method.name;
            await existing.save();
        }
    }
}

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

export async function seedDefaults() {
    if ((await FuelProductModel.countDocuments()) === 0) {
        await FuelProductModel.insertMany(DEFAULT_PRODUCTS);
    }

    await ensurePaymentMethods();

    if ((await ExpenseCategoryModel.countDocuments()) === 0) {
        await ExpenseCategoryModel.insertMany(
            DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({
                name,
                sortOrder: index + 1,
            }))
        );
    }

    if ((await TransactionCategoryModel.countDocuments()) === 0) {
        await TransactionCategoryModel.insertMany(
            DEFAULT_TXN_CATEGORIES.map((category, index) => ({
                ...category,
                sortOrder: index + 1,
            }))
        );
    }
}
