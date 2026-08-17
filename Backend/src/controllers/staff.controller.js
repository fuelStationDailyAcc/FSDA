import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DEFAULT_STAFF_PERMISSIONS, normalizePermissions } from "../constants/permissions.js";

export const listStaff = asyncHandler(async (req, res) => {
    const staff = await User.listByOwner(req.user._id);
    return res
        .status(200)
        .json(new ApiResponse(200, staff.map(User.toPublicUser), "Staff fetched"));
});

export const createStaff = asyncHandler(async (req, res) => {
    const { username, password, permissions } = req.body;

    if (!username?.trim() || !password?.trim()) {
        throw new ApiError(400, "Username and password are required");
    }

    if (username.trim().length < 3) {
        throw new ApiError(400, "Username must be at least 3 characters");
    }

    if (password.trim().length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters");
    }

    const existed = await User.findByUsernameOrEmail({
        username: username.trim().toLowerCase(),
    });
    if (existed) {
        throw new ApiError(409, "User with this username already exists");
    }

    const staff = await User.create({
        username: username.trim(),
        password,
        stationName: req.user.stationName,
        role: "staff",
        ownerId: req.user._id,
        permissions: normalizePermissions(permissions, DEFAULT_STAFF_PERMISSIONS),
    });

    return res
        .status(201)
        .json(new ApiResponse(201, User.toPublicUser(staff), "Staff account created"));
});

export const updateStaff = asyncHandler(async (req, res) => {
    const { username, password, permissions } = req.body;

    if (username !== undefined && username.trim().length < 3) {
        throw new ApiError(400, "Username must be at least 3 characters");
    }

    if (password !== undefined && password.trim() && password.trim().length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters");
    }

    if (username?.trim()) {
        const existed = await User.findByUsernameOrEmail({
            username: username.trim().toLowerCase(),
        });
        if (existed && String(existed._id) !== String(req.params.id)) {
            throw new ApiError(409, "User with this username already exists");
        }
    }

    const staff = await User.updateStaff(req.params.id, req.user._id, {
        username,
        password,
        permissions: permissions === undefined ? undefined : normalizePermissions(permissions),
    });

    if (!staff) {
        throw new ApiError(404, "Staff account not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, User.toPublicUser(staff), "Staff account updated"));
});

export const deleteStaff = asyncHandler(async (req, res) => {
    const staff = await User.deleteStaff(req.params.id, req.user._id);
    if (!staff) {
        throw new ApiError(404, "Staff account not found");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Staff account deleted"));
});
