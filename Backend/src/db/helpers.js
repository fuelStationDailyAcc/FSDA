import mongoose from "mongoose";

export function toId(value) {
    if (value == null) return null;
    return String(value);
}

export function isValidObjectId(id) {
    return Boolean(id) && mongoose.Types.ObjectId.isValid(id);
}

export function asObjectId(id) {
    if (!id) return id;
    if (id instanceof mongoose.Types.ObjectId) return id;
    return new mongoose.Types.ObjectId(String(id));
}

export function isDuplicateKeyError(error) {
    return error?.code === 11000 || error?.code === 11001;
}

export function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function leanDoc(doc) {
    if (!doc) return null;
    return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

export function assignIfPresent(target, key, value, transform) {
    if (value === undefined || value === null) return;
    target[key] = transform ? transform(value) : value;
}
