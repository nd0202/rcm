// models/Post.js
import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  ownerId: String,
  type: String, // 'image'
  image_url: String,
  text: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});
export const Image = mongoose.model('Image', ImageSchema);
