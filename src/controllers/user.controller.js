import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/uploadOnCloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler(async (req, res) => {
    // Get user details from frontend
    const { fullName, email, userName, password } = req.body;
    console.log("email: ", email);

    // Validation - not empty 
    if ([fullName, email, userName, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if user is already registered: username, email
    const existingUser = await User.findOne({
        $or: [
            { userName },
            { email }
        ]
    });
    if (existingUser) {
        throw new ApiError(409, "User email or username already exists");
    }

    // Check for img, check for avatar 
    const avatarFile = req.files?.avatar?.[0];
    let coverImageFile;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageFile = req.files.coverImage[0].path;
    }

    if (!avatarFile) {
        throw new ApiError(400, "User avatar is required");
    }

    // Upload them to Cloudinary with retry mechanism
    const uploadWithRetry = async (filePath, retries = 3) => {
        while (retries > 0) {
            try {
                const result = await uploadOnCloudinary(filePath);
                return result;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
            }
        }
    };

    let avatar, coverImage;
    try {
        avatar = await uploadWithRetry(avatarFile.path);
        if (coverImageFile) {
            coverImage = await uploadWithRetry(coverImageFile);
        }
    } catch (error) {
        console.error("Error uploading to Cloudinary", error);
        throw new ApiError(500, "Failed to upload images to Cloudinary");
    }

    // Create user object - create entry in DB 
    const user = await User.create({
        fullName,
        email,
        userName: userName.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    // Remove password and refresh token fields from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if (!createdUser) {
        throw new ApiError(500, "User not created");
    }

    // Return response 
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    );
});

export { registerUser };
