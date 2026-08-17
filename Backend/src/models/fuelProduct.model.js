import mongoose from "mongoose";
import { assignIfPresent, isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const fuelProductSchema = new mongoose.Schema(
    {
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
    async list({ activeOnly = false } = {}) {
        const filter = activeOnly ? { isActive: true } : {};
        const rows = await FuelProductModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapProduct);
    },

    async findById(id) {
        if (!isValidObjectId(id)) return null;
        const doc = await FuelProductModel.findById(id);
        return mapProduct(doc);
    },

    async create({ name, productType, currentRatePaise, sortOrder = 0 }) {
        const doc = await FuelProductModel.create({
            name: name.trim(),
            productType: productType || "Other",
            currentRatePaise: Number(currentRatePaise) || 0,
            sortOrder,
        });
        return mapProduct(doc);
    },

    async update(id, { name, productType, currentRatePaise, isActive, sortOrder }) {
        if (!isValidObjectId(id)) return null;
        const $set = {};
        assignIfPresent($set, "name", name, (value) => value.trim());
        assignIfPresent($set, "productType", productType);
        assignIfPresent($set, "currentRatePaise", currentRatePaise, Number);
        assignIfPresent($set, "isActive", isActive);
        assignIfPresent($set, "sortOrder", sortOrder);
        const doc = await FuelProductModel.findByIdAndUpdate(id, { $set }, { new: true });
        return mapProduct(doc);
    },
};
