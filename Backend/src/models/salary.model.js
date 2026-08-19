import mongoose from "mongoose";
import { assignIfPresent, isValidObjectId, leanDoc, toId } from "../db/helpers.js";

const salarySchema = new mongoose.Schema(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        salaryPaise: { type: Number, default: 0 },
        notes: { type: String, default: null },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "salaries" }
);

export const SalaryModel =
    mongoose.models.Salary || mongoose.model("Salary", salarySchema);

function mapSalary(doc) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        name: row.name,
        salaryPaise: Number(row.salaryPaise ?? 0),
        notes: row.notes || null,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export const Salary = {
    async list(ownerId, { activeOnly = false } = {}) {
        if (!isValidObjectId(ownerId)) return [];
        const filter = { ownerId };
        if (activeOnly) filter.isActive = true;
        const rows = await SalaryModel.find(filter).sort({ sortOrder: 1, name: 1 });
        return rows.map(mapSalary);
    },

    async findById(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const doc = await SalaryModel.findOne({ _id: id, ownerId });
        return mapSalary(doc);
    },

    async create(ownerId, { name, salaryPaise, notes, sortOrder = 0 }) {
        if (!isValidObjectId(ownerId)) return null;
        const doc = await SalaryModel.create({
            ownerId,
            name: name.trim(),
            salaryPaise: Number(salaryPaise) || 0,
            notes: notes?.trim() || null,
            sortOrder,
        });
        return mapSalary(doc);
    },

    async update(id, ownerId, { name, salaryPaise, notes, isActive, sortOrder }) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const $set = {};
        assignIfPresent($set, "name", name, (value) => value.trim());
        assignIfPresent($set, "salaryPaise", salaryPaise, Number);
        assignIfPresent($set, "notes", notes, (value) => value?.trim() || null);
        assignIfPresent($set, "isActive", isActive);
        assignIfPresent($set, "sortOrder", sortOrder);
        const doc = await SalaryModel.findOneAndUpdate({ _id: id, ownerId }, { $set }, { new: true });
        return mapSalary(doc);
    },

    async delete(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const doc = await SalaryModel.findOneAndDelete({ _id: id, ownerId });
        return mapSalary(doc);
    },
};
