import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hasPermission, isOwner } from "../constants/permissions.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decoded?._id);

        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }

        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

export const requireOwner = asyncHandler(async (req, res, next) => {
    if (!isOwner(req.user)) {
        throw new ApiError(403, "Only the station owner can manage staff");
    }
    next();
});

export function requirePermission(key) {
    return asyncHandler(async (req, res, next) => {
        if (!hasPermission(req.user, key)) {
            throw new ApiError(403, "You do not have permission to do that");
        }
        next();
    });
}

export function requireAnyPermission(...keys) {
    return asyncHandler(async (req, res, next) => {
        if (keys.some((key) => hasPermission(req.user, key))) {
            return next();
        }
        throw new ApiError(403, "You do not have permission to do that");
    });
}
