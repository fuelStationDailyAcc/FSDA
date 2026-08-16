import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 24 * 60 * 60 * 1000,
};

const issueTokens = async (user) => {
    const accessToken = User.generateAccessToken(user);
    const refreshToken = User.generateRefreshToken(user);
    await User.setRefreshToken(user._id, refreshToken);
    return { accessToken, refreshToken };
};

const sendAuthResponse = async (res, user, message, statusCode = 200) => {
    const { accessToken, refreshToken } = await issueTokens(user);

    return res
        .status(statusCode)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                statusCode,
                {
                    user: User.toPublicUser(user),
                    accessToken,
                    refreshToken,
                },
                message
            )
        );
};

export const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if ([username, email, password].some((field) => !field?.trim())) {
        throw new ApiError(400, "Username, email, and password are required");
    }

    if (password.trim().length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters");
    }

    const existedUser = await User.findByUsernameOrEmail({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
    });

    if (existedUser) {
        throw new ApiError(409, "User with this username or email already exists");
    }

    const user = await User.create({
        username: username.trim(),
        email: email.trim(),
        password,
    });

    return sendAuthResponse(res, user, "User registered successfully", 201);
});

export const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!password?.trim() || (!username?.trim() && !email?.trim())) {
        throw new ApiError(400, "Email or username and password are required");
    }

    const user = await User.findByUsernameOrEmail({
        email: email?.trim().toLowerCase(),
        username: username?.trim().toLowerCase(),
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await User.isPasswordCorrect(user, password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    return sendAuthResponse(res, user, "User logged in successfully");
});

export const logoutUser = asyncHandler(async (req, res) => {
    await User.unsetRefreshToken(req.user._id);

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, User.toPublicUser(req.user), "Current user fetched successfully")
        );
});
