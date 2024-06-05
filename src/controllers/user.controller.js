import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary}  from '../utils/uploadOnCloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
// import { uploadOnCloudinary } from '../utils/uploadOnCloudinary.js';

const registerUser = asyncHandler(async (req, res) => {
    // get use deatail  from frontend
    // validation - not empty 
    // check if user is already registered : username , emil
    // check for img , check for avatar 
    // upload them to cloudinary 
    // create use object - create entry in DB 
    // remove password ans refresh token feild freom response
    // check for user creation
    // retun response 

   const {fullName,email,userName,password}= req.body 
    console.log("email: " ,  email);

    if([fullName,email,userName,password].some((field) => field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

   const exitstedUser = User.findOne({
        $or:[
            {userName},
            {email}
        ]
    })
    if(exitstedUser){
        throw new ApiError(409,"User email username already exist")
    }
   const avatarLocalPath = req.files?.avatar[0].path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path;

   if(!avatarLocalPath){
    throw new ApiError(400,"User avatar is required");
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath); 
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if(!avatar){
    throw new ApiError(400,"User avatar is required");
   }

  const user = await User.create({
    fullName,
    email,
    userName:userName.toLowerCase(),
    password,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
   })

   const createdUser=await User.findById(user._id).select(
    "-password -refreshToken "
   )

   if(!createdUser){
    throw new ApiError(500,"User not created")
   }

   return res.status(201).json(
    new ApiResponse(200,createdUser,"user created successfully")
   )

}) 


export { registerUser }