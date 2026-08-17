import mongoose from "mongoose";
import { assignIfPresent, isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const paymentMethodSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, unique: true, trim: true, lowercase: true },
        methodType: { type: String, default: "other" },
        reducesCash: { type: Boolean, default: true },
        isCashTaken: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "payment_methods" }
);

export const PaymentMethodModel =
    mongoose.models.PaymentMethod || mongoose.model("PaymentMethod", paymentMethodSchema);

function mapMethod(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        name: row.name,
        code: row.code,
        methodType: row.methodType,
        reducesCash: row.reducesCash,
        isCashTaken: row.isCashTaken,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export const PaymentMethod = {
    async list({ activeOnly = false } = {}) {
        const filter = activeOnly ? { isActive: true } : {};
        const rows = await PaymentMethodModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapMethod);
    },

    async findById(id) {
        if (!isValidObjectId(id)) return null;
        const doc = await PaymentMethodModel.findById(id);
        return mapMethod(doc);
    },

    async create(data) {
        const doc = await PaymentMethodModel.create({
            name: data.name.trim(),
            code: data.code.trim().toLowerCase().replace(/\s+/g, "_"),
            methodType: data.methodType || "other",
            reducesCash: data.reducesCash !== false,
            isCashTaken: !!data.isCashTaken,
            sortOrder: data.sortOrder || 0,
        });
        return mapMethod(doc);
    },

    async update(id, data) {
        if (!isValidObjectId(id)) return null;
        const $set = {};
        assignIfPresent($set, "name", data.name, (value) => value.trim());
        assignIfPresent($set, "methodType", data.methodType);
        assignIfPresent($set, "reducesCash", data.reducesCash);
        assignIfPresent($set, "isCashTaken", data.isCashTaken);
        assignIfPresent($set, "isActive", data.isActive);
        assignIfPresent($set, "sortOrder", data.sortOrder);
        const doc = await PaymentMethodModel.findByIdAndUpdate(id, { $set }, { new: true });
        return mapMethod(doc);
    },

    async delete(id) {
        if (!isValidObjectId(id)) return null;
        const { DailyPaymentCollection, Expense, LedgerTransaction } = await import(
            "./accounts.model.js"
        );
        const [inCollections, inExpenses, inLedger] = await Promise.all([
            DailyPaymentCollection.exists({ paymentMethodId: id }),
            Expense.exists({ paymentMethodId: id }),
            LedgerTransaction.exists({ paymentMethodId: id }),
        ]);
        if (inCollections || inExpenses || inLedger) {
            const { ApiError } = await import("../utils/apiError.js");
            throw new ApiError(409, "Cannot remove payment method that is used in daily accounts");
        }
        const doc = await PaymentMethodModel.findByIdAndDelete(id);
        return mapMethod(doc);
    },
};
