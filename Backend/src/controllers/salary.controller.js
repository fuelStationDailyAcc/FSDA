import { Salary } from "../models/salary.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toPaise } from "../services/money.js";
import { requireStationOwnerId } from "../utils/tenant.js";

export const listSalaries = asyncHandler(async (req, res) => {
    const data = await Salary.list(requireStationOwnerId(req.user), {
        activeOnly: req.query.activeOnly === "true",
    });
    return res.status(200).json(new ApiResponse(200, data, "Salaries fetched"));
});

export const createSalary = asyncHandler(async (req, res) => {
    if (!req.body.name?.trim()) throw new ApiError(400, "Name is required");
    const data = await Salary.create(requireStationOwnerId(req.user), {
        name: req.body.name,
        salaryPaise: toPaise(req.body.salaryRupees),
        notes: req.body.notes,
        sortOrder: req.body.sortOrder,
    });
    return res.status(201).json(new ApiResponse(201, data, "Salary entry created"));
});

export const updateSalary = asyncHandler(async (req, res) => {
    const data = await Salary.update(req.params.id, requireStationOwnerId(req.user), {
        name: req.body.name,
        salaryPaise:
            req.body.salaryRupees === undefined ? undefined : toPaise(req.body.salaryRupees),
        notes: req.body.notes,
        isActive: req.body.isActive,
        sortOrder: req.body.sortOrder,
    });
    if (!data) throw new ApiError(404, "Salary entry not found");
    return res.status(200).json(new ApiResponse(200, data, "Salary entry updated"));
});

export const deleteSalary = asyncHandler(async (req, res) => {
    const data = await Salary.delete(req.params.id, requireStationOwnerId(req.user));
    if (!data) throw new ApiError(404, "Salary entry not found");
    return res.status(200).json(new ApiResponse(200, data, "Salary entry removed"));
});
