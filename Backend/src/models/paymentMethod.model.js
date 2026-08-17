import mongoose from "mongoose";
import { assignIfPresent, isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const paymentMethodSchema = new mongoose.Schema(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, lowercase: true },
        methodType: { type: String, default: "other" },
        reducesCash: { type: Boolean, default: true },
        isCashTaken: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "payment_methods" }
);

paymentMethodSchema.index({ ownerId: 1, code: 1 }, { unique: true });

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
    async list(ownerId, { activeOnly = false } = {}) {
        if (!isValidObjectId(ownerId)) return [];
        const filter = { ownerId };
        if (activeOnly) filter.isActive = true;
        const rows = await PaymentMethodModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapMethod);
    },

    async findById(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const doc = await PaymentMethodModel.findOne({ _id: id, ownerId });
        return mapMethod(doc);
    },

    async create(ownerId, data) {
        if (!isValidObjectId(ownerId)) return null;
        const doc = await PaymentMethodModel.create({
            ownerId,
            name: data.name.trim(),
            code: data.code.trim().toLowerCase().replace(/\s+/g, "_"),
            methodType: data.methodType || "other",
            reducesCash: data.reducesCash !== false,
            isCashTaken: !!data.isCashTaken,
            sortOrder: data.sortOrder || 0,
        });
        return mapMethod(doc);
    },

    async update(id, ownerId, data) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const $set = {};
        assignIfPresent($set, "name", data.name, (value) => value.trim());
        assignIfPresent($set, "methodType", data.methodType);
        assignIfPresent($set, "reducesCash", data.reducesCash);
        assignIfPresent($set, "isCashTaken", data.isCashTaken);
        assignIfPresent($set, "isActive", data.isActive);
        assignIfPresent($set, "sortOrder", data.sortOrder);
        const doc = await PaymentMethodModel.findOneAndUpdate(
            { _id: id, ownerId },
            { $set },
            { new: true }
        );
        return mapMethod(doc);
    },

    async delete(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const owned = await PaymentMethodModel.findOne({ _id: id, ownerId }).select("_id");
        if (!owned) return null;

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
        const doc = await PaymentMethodModel.findOneAndDelete({ _id: id, ownerId });
        return mapMethod(doc);
    },
};
