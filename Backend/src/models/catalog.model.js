import mongoose from "mongoose";
import { assignIfPresent, isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const expenseCategorySchema = new mongoose.Schema(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "expense_categories" }
);

expenseCategorySchema.index({ ownerId: 1, name: 1 }, { unique: true });

const transactionCategorySchema = new mongoose.Schema(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, default: "BOTH" },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "transaction_categories" }
);

export const ExpenseCategoryModel =
    mongoose.models.ExpenseCategory || mongoose.model("ExpenseCategory", expenseCategorySchema);

export const TransactionCategoryModel =
    mongoose.models.TransactionCategory ||
    mongoose.model("TransactionCategory", transactionCategorySchema);

function mapCat(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        name: row.name,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
    };
}

function mapTxnCat(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        name: row.name,
        type: row.type,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
    };
}

export const ExpenseCategory = {
    async list(ownerId, { activeOnly = false } = {}) {
        if (!isValidObjectId(ownerId)) return [];
        const filter = { ownerId };
        if (activeOnly) filter.isActive = true;
        const rows = await ExpenseCategoryModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapCat);
    },

    async create(ownerId, { name, sortOrder = 0 }) {
        if (!isValidObjectId(ownerId)) return null;
        const doc = await ExpenseCategoryModel.create({
            ownerId,
            name: name.trim(),
            sortOrder,
        });
        return mapCat(doc);
    },

    async update(id, ownerId, { name, isActive, sortOrder }) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const $set = {};
        assignIfPresent($set, "name", name, (value) => value.trim());
        assignIfPresent($set, "isActive", isActive);
        assignIfPresent($set, "sortOrder", sortOrder);
        const doc = await ExpenseCategoryModel.findOneAndUpdate(
            { _id: id, ownerId },
            { $set },
            { new: true }
        );
        return mapCat(doc);
    },

    async delete(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const owned = await ExpenseCategoryModel.findOne({ _id: id, ownerId }).select("_id");
        if (!owned) return null;
        const { Expense } = await import("./accounts.model.js");
        const inUse = await Expense.exists({ categoryId: id });
        if (inUse) {
            const { ApiError } = await import("../utils/apiError.js");
            throw new ApiError(409, "Cannot remove category that is used in expenses");
        }
        const doc = await ExpenseCategoryModel.findOneAndDelete({ _id: id, ownerId });
        return mapCat(doc);
    },
};

export const TransactionCategory = {
    async list(ownerId, { activeOnly = false } = {}) {
        if (!isValidObjectId(ownerId)) return [];
        const filter = { ownerId };
        if (activeOnly) filter.isActive = true;
        const rows = await TransactionCategoryModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapTxnCat);
    },
};
