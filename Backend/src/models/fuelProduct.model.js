import mongoose from "mongoose";
import { assignIfPresent, asObjectId, isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const fuelProductSchema = new mongoose.Schema(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        productType: { type: String, default: "Other" },
        currentRatePaise: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "fuel_products" }
);

export const FuelProductModel =
    mongoose.models.FuelProduct || mongoose.model("FuelProduct", fuelProductSchema);

function mapProduct(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        name: row.name,
        productType: row.productType,
        currentRatePaise: Number(row.currentRatePaise),
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export const FuelProduct = {
    async list(ownerId, { activeOnly = false } = {}) {
        if (!isValidObjectId(ownerId)) return [];
        const filter = { ownerId };
        if (activeOnly) filter.isActive = true;
        const rows = await FuelProductModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapProduct);
    },

    async findById(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const doc = await FuelProductModel.findOne({ _id: id, ownerId });
        return mapProduct(doc);
    },

    async create(ownerId, { name, productType, currentRatePaise, sortOrder = 0 }) {
        if (!isValidObjectId(ownerId)) return null;
        const doc = await FuelProductModel.create({
            ownerId,
            name: name.trim(),
            productType: productType || "Other",
            currentRatePaise: Number(currentRatePaise) || 0,
            sortOrder,
        });
        return mapProduct(doc);
    },

    async update(id, ownerId, { name, productType, currentRatePaise, isActive, sortOrder }) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const $set = {};
        assignIfPresent($set, "name", name, (value) => value.trim());
        assignIfPresent($set, "productType", productType);
        assignIfPresent($set, "currentRatePaise", currentRatePaise, Number);
        assignIfPresent($set, "isActive", isActive);
        assignIfPresent($set, "sortOrder", sortOrder);
        const doc = await FuelProductModel.findOneAndUpdate(
            { _id: id, ownerId },
            { $set },
            { new: true }
        );
        return mapProduct(doc);
    },

    async delete(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const owned = await FuelProductModel.findOne({ _id: id, ownerId }).select("_id");
        if (!owned) return null;

        const productId = asObjectId(id);
        const { DailyAccount, FuelMeterReading } = await import("./accounts.model.js");

        const openDays = await DailyAccount.find({ ownerId, status: "open" }).select("_id");
        if (openDays.length) {
            await FuelMeterReading.deleteMany({
                productId,
                dailyAccountId: { $in: openDays.map((day) => day._id) },
                litres: 0,
                testingLitres: 0,
                netLitres: 0,
                totalSalePaise: 0,
            });
        }

        const inUse = await FuelMeterReading.exists({ productId });
        if (inUse) {
            const doc = await FuelProductModel.findOneAndUpdate(
                { _id: id, ownerId },
                { $set: { isActive: false } },
                { new: true }
            );
            const mapped = mapProduct(doc);
            return mapped ? { ...mapped, deactivated: true } : null;
        }

        const doc = await FuelProductModel.findOneAndDelete({ _id: id, ownerId });
        return mapProduct(doc);
    },
};
