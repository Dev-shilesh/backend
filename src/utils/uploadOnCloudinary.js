import { v2 as cloudinary } from "cloudinary"
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config(
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    }
);

// const unlinkAsync = promisify(fs.unlink);


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // upload the file on the cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfully
        console.log("file uploaded one cloudniray successfully", response.url);
        return response
    } catch (error) {
        // locally  saved temporary file as uploaded opration got failed
        console.error("Error uploading to Cloudinary", error);
         fs.unlinkSync(localFilePath);
        return null;
    }
}

export { uploadOnCloudinary }; 