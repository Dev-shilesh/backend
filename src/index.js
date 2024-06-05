import dotenv from 'dotenv';
import connectDB from './db/index.js';
import app from './app.js';

dotenv.config({
    path:'./.env'
})

connectDB()
.then(() => {
    app.on('error',(error)=>{
        console.error("Error: " + error)
        throw error;
    });
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running on port http://localhost:${process.env.PORT}`)
    });
})
.catch((err) => {
    console.error("Mongo db connection failed !!!: " + err)
    throw err;
})








/* import express from 'express';
const app = express();
(async()=>{
    try {
        mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        app.on('error',(error)=>{
            console.error("Error: " + error)
            throw error;
        })
        app.listen(process.env.PORT,()=>{
            console.log(`Server is running on port ${process.env.PORT}`)
        })
    
    } catch (error) {
        console.error("Error: " + error)
        throw error;
    }
})() */
// mongoose.connect('mongodb://localhost:27017/test', { useNewUrlParser: true });
 