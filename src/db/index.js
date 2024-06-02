import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
      const connectionInstance =  await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);

      console.log(`\n MongoDB Connected: ${connectionInstance.connection.host}:${connectionInstance.connection.port}/${DB_NAME}`);

      return connectionInstance;
    } catch (error) {
        console.error("MONGODB connection Error",error);
        process.exit(1);
    }
}

export default connectDB;