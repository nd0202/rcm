// models/Post.js
import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, default: "Untitled" },
  description: { type: String, default: "" },
  media_key: { type: String, required: true },    // s3 key
  media_type: { type: String, enum: ["video", "image"], required: true },
  thumbnail_key: { type: String }, // s3 key of thumbnail image (optional)
  status: { type: String, default: "ready" },
}, { timestamps: true });

export const Post = mongoose.model("Post", PostSchema);
