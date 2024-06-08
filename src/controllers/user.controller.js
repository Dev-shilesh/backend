import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary, deleteFromCloudinary } from '../utils/uploadOnCloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken'; // Added missing import for jwt


const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, userName, password } = req.body;

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

    // Get avatar and cover image paths from request
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    // Check if avatar file is provided
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // Upload avatar to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar || !avatar.url) {
        throw new ApiError(400, "Error uploading avatar");
    }

    // Upload cover image to Cloudinary if provided
    let coverImage;
    if (coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath);
        if (!coverImage || !coverImage.url) {
            throw new ApiError(400, "Error uploading cover image");
        }
    }

    // Create user object - create entry in DB 
    const user = await User.create({
        fullName,
        email,
        userName: userName.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url,
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


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token", error);
    }
};

const refreshAccessToken = async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshAccessToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthenticated request")

    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,

        )

        const user = User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh Token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "fresh token is expired");
        }
        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken, refreshToken: newRefreshToken
                    },
                    "Access token successfully"
                )
            )
    } catch (error) {
        throw new ApiError(401, error.message || "Invalid access token")
    }
}

const loginUser = asyncHandler(async (req, res) => {
    const { email, userName, password } = req.body;

    if (!userName && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    const user = await User.findOne({
        $or: [{ userName: userName }, { email: email }]
    });

    if (!user) {
        throw new ApiError(404, "User does not exist!!");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: "" } }, { new: true });

    const options = {
        httpOnly: true,
        secure: true,
    };

    res
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"));
});


const changeCurrentPassword = asyncHandler(async (req, res) => {

    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(new ApiResponse(200, {}, "Password chagesd successfully updated"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched successfully"))
    // .json(200, req.user, "current user fetched successfully")
})

const updatedAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            fullName,
            email: email
        }
    }, { new: true }).select("-password")

    return res.status(200)
        .json(new ApiResponse(200, {}, "Account details updated successfully"))
})

// const updateUserAvatar = asyncHandler(async (req, res) => {
//     const avatarLocalPath = req.file?.path
//     if (!avatarLocalPath) {
//         throw new ApiError(400, "Avatar file is not found ")
//     }

//     // todo: remove when delete old avatar image
//     const avatar = await uploadOnCloudinary(avatarLocalPath)

//     if (!avatar.url) {
//         throw new ApiError(400, "Error while uploading on avatar")
//     }

//     const user = await User.findByIdAndUpdate(req.user?._id, {
//         $set: {
//             avatar: avatar.url
//         }
//     }, { new: true }).select("-password")

//     return res.status(200)
//         .json(new ApiResponse(200, user, "avatar updated successfully"))

// })

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is not found");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const oldAvatarUrl = user.avatar;

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar?.url) {
        throw new ApiError(400, "Error while uploading avatar");
    }

    user.avatar = avatar.url;
    await user.save({ validateBeforeSave: false });

    if (oldAvatarUrl) {
        const oldAvatarPublicId = getPublicIdFromUrl(oldAvatarUrl);
        if (oldAvatarPublicId) {
            await deleteFromCloudinary(oldAvatarPublicId);
        }
    }

    const updatedUser = await User.findById(req.user._id).select("-password");

    return res.status(200).json(new ApiResponse(200, updatedUser, "Avatar updated successfully"));
});

const getPublicIdFromUrl = (url) => {
    // Assuming the URL follows the pattern 'https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{format}'
    const parts = url.split('/');
    const publicIdWithExtension = parts[parts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0]; // Removing the extension

    return publicId;
}

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is not found ")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, { new: true }).select("-password")

    return res.status(200)
        .json(new ApiResponse(200, user, "Cover image updated successfully"))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { userName } = req.params

    if (!userName?.trim()) {
        throw new ApiError(400, "User name is required")
    }

    const channel = await User.aggregate([
        {
            $match: {
                userName: userName?.toLowerCase()
            }
        }, {
            $lookup: {
                from: "subcription",
                localField: "_id",
                foreignField: "channel",
                as: "subcribers"
            }
        }, {
            $lookup: {
                from: "subcription",
                localField: "_id",
                foreignField: "subcriber",
                as: "subscribedTo"
            }
        }, {
            $add: {
                $subscribersCount: {
                    $size: "$subcribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subcribers.subcriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        }, {
            $project: {
                // _id:1,
                userName: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                channelsSubscribedToCount: 1,
                subscribersCount: 1,
                isSubscribed: 1,
                email: 1,
            }
        }

    ])
    if (!channel?.length) {
        throw new ApiError(404, " channel is not available")
    }

    return res.status(200)
        .json(new ApiResponse(200, channel[0], "channel profile fetched successfully"))
})
export { registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser, changeCurrentPassword, updatedAccountDetails, updateUserAvatar, updateUserCoverImage ,getUserChannelProfile};
