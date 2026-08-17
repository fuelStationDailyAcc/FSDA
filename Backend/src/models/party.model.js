import mongoose from "mongoose";
import { assignIfPresent, isValidObjectId, leanDoc, toId } from "../db/helpers.js";
import { LedgerTransaction } from "./accounts.model.js";

function createPartySchema(collection) {
    return new mongoose.Schema(
        {
            ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
            name: { type: String, required: true, trim: true },
            phone: { type: String, default: null },
            notes: { type: String, default: null },
            isActive: { type: Boolean, default: true },
        },
        { timestamps: true, collection }
    );
}

export const CustomerModel =
    mongoose.models.Customer || mongoose.model("Customer", createPartySchema("customers"));
export const VendorModel =
    mongoose.models.Vendor || mongoose.model("Vendor", createPartySchema("vendors"));

function mapParty(doc, type) {
    const row = leanDoc(doc);
    if (!row) return null;
    return {
        id: toId(row._id),
        type,
        name: row.name,
        phone: row.phone,
        notes: row.notes,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

async function partyBalances(Model, partyType, ownerId) {
    if (!isValidObjectId(ownerId)) return [];
    const parties = await Model.find({ ownerId }).sort({ name: 1 }).lean();
    const ids = parties.map((party) => party._id);
    const totals = ids.length
        ? await LedgerTransaction.aggregate([
              { $match: { partyType, partyId: { $in: ids } } },
              {
                  $group: {
                      _id: "$partyId",
                      creditPaise: {
                          $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amountPaise", 0] },
                      },
                      debitPaise: {
                          $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amountPaise", 0] },
                      },
                  },
              },
          ])
        : [];

    const totalsByParty = new Map(totals.map((row) => [String(row._id), row]));

    return parties.map((party) => {
        const totalsRow = totalsByParty.get(String(party._id)) || {
            creditPaise: 0,
            debitPaise: 0,
        };
        const totalIn =
            partyType === "customer" ? Number(totalsRow.creditPaise) : Number(totalsRow.debitPaise);
        const totalOut =
            partyType === "customer" ? Number(totalsRow.debitPaise) : Number(totalsRow.creditPaise);
        const base = mapParty(party, partyType);
        if (partyType === "customer") {
            return {
                ...base,
                totalCreditPaise: totalIn,
                totalPaidPaise: totalOut,
                outstandingPaise: totalIn - totalOut,
            };
        }
        return {
            ...base,
            totalPurchasesPaise: totalIn,
            totalPaidPaise: totalOut,
            outstandingPaise: totalIn - totalOut,
        };
    });
}

export const Customer = {
    async list(ownerId) {
        return partyBalances(CustomerModel, "customer", ownerId);
    },

    async create(ownerId, { name, phone, notes }) {
        if (!isValidObjectId(ownerId)) return null;
        const doc = await CustomerModel.create({
            ownerId,
            name: name.trim(),
            phone: phone || null,
            notes: notes || null,
        });
        return mapParty(doc, "customer");
    },

    async update(id, ownerId, { name, phone, notes, isActive }) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const $set = {};
        assignIfPresent($set, "name", name, (value) => value.trim());
        assignIfPresent($set, "phone", phone);
        assignIfPresent($set, "notes", notes);
        assignIfPresent($set, "isActive", isActive);
        const doc = await CustomerModel.findOneAndUpdate({ _id: id, ownerId }, { $set }, { new: true });
        return mapParty(doc, "customer");
    },

    async delete(id, ownerId) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const doc = await CustomerModel.findOneAndDelete({ _id: id, ownerId });
        if (!doc) return null;
        await LedgerTransaction.updateMany(
            { ownerId, partyType: "customer", partyId: id },
            { $set: { partyId: null } }
        );
        return mapParty(doc, "customer");
    },
};

export const Vendor = {
    async list(ownerId) {
        return partyBalances(VendorModel, "vendor", ownerId);
    },

    async create(ownerId, { name, phone, notes }) {
        if (!isValidObjectId(ownerId)) return null;
        const doc = await VendorModel.create({
            ownerId,
            name: name.trim(),
            phone: phone || null,
            notes: notes || null,
        });
        return mapParty(doc, "vendor");
    },

    async update(id, ownerId, { name, phone, notes, isActive }) {
        if (!isValidObjectId(id) || !isValidObjectId(ownerId)) return null;
        const $set = {};
        assignIfPresent($set, "name", name, (value) => value.trim());
        assignIfPresent($set, "phone", phone);
        assignIfPresent($set, "notes", notes);
        assignIfPresent($set, "isActive", isActive);
        const doc = await VendorModel.findOneAndUpdate({ _id: id, ownerId }, { $set }, { new: true });
        return mapParty(doc, "vendor");
    },
};
