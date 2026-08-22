import { FuelProductModel } from "../models/fuelProduct.model.js";
import { PaymentMethodModel } from "../models/paymentMethod.model.js";
import { ExpenseCategoryModel, TransactionCategoryModel } from "../models/catalog.model.js";
import { UserModel } from "../models/user.model.js";

const DEFAULT_PRODUCTS = [
    { name: "MS", productType: "MS", currentRatePaise: 10491, sortOrder: 1 },
    { name: "MS2", productType: "MS", currentRatePaise: 10491, sortOrder: 2 },
    { name: "HSD", productType: "HSD", currentRatePaise: 9484, sortOrder: 3 },
    { name: "HSD2", productType: "HSD", currentRatePaise: 9484, sortOrder: 4 },
];

const DEFAULT_PAYMENT_METHODS = [
    { name: "Cash", code: "cash", methodType: "cash", reducesCash: false, isCashTaken: false, sortOrder: 1 },
    { name: "Credit", code: "credit", methodType: "credit", reducesCash: true, isCashTaken: false, sortOrder: 2 },
    { name: "Card", code: "card", methodType: "card", reducesCash: true, isCashTaken: false, sortOrder: 3 },
    { name: "Online Payment", code: "online_payments", methodType: "online", reducesCash: true, isCashTaken: false, sortOrder: 4 },
    { name: "Bank Payment", code: "bank", methodType: "bank", reducesCash: true, isCashTaken: false, sortOrder: 5 },
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

async function ensurePaymentMethods(ownerId) {
    for (const method of DEFAULT_PAYMENT_METHODS) {
        const existing = await PaymentMethodModel.findOne({ ownerId, code: method.code });
        if (!existing) {
            await PaymentMethodModel.create({ ...method, ownerId, isActive: true });
            continue;
        }
        if (method.code === "online_payments" && existing.name === "Online Payments") {
            existing.name = method.name;
            await existing.save();
        }
    }
}

export async function seedOwnerDefaults(ownerId) {
    if (!ownerId) return;

    if ((await FuelProductModel.countDocuments({ ownerId })) === 0) {
        await FuelProductModel.insertMany(
            DEFAULT_PRODUCTS.map((product) => ({ ...product, ownerId }))
        );
    }

    await ensurePaymentMethods(ownerId);

    if ((await ExpenseCategoryModel.countDocuments({ ownerId })) === 0) {
        await ExpenseCategoryModel.insertMany(
            DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({
                name,
                ownerId,
                sortOrder: index + 1,
            }))
        );
    }

    if ((await TransactionCategoryModel.countDocuments({ ownerId })) === 0) {
        await TransactionCategoryModel.insertMany(
            DEFAULT_TXN_CATEGORIES.map((category, index) => ({
                ...category,
                ownerId,
                sortOrder: index + 1,
            }))
        );
    }
}

export async function seedDefaults() {
    const owners = await UserModel.find({
        $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    })
        .select("_id")
        .lean();

    for (const owner of owners) {
        await seedOwnerDefaults(owner._id);
    }
}
