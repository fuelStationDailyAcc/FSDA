import { isValidObjectId } from "../db/helpers.js";
import { ApiError } from "./apiError.js";

export function getStationOwnerId(user) {
    if (!user) return null;
    return user.ownerId || user._id || null;
}

export function requireStationOwnerId(user) {
    const ownerId = getStationOwnerId(user);
    if (!isValidObjectId(ownerId)) {
        throw new ApiError(401, "Unauthorized request");
    }
    return ownerId;
}
