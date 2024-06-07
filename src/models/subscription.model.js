import mongoose, { Schema } from "mongoose";

const subcriptionSchema = new Schema(
    {
        subcriber: {
            // one who os subsribimg
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        channel: {
            type: Schema.Types.ObjectId,
            ref: "User",
        }
    }, { timestamps: true }
)

export const Subcription = mongoose.model('Subcription', subcriptionSchema);