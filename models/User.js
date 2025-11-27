import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  password: String,
  refreshToken: String, 
  avatar_url: String,
   followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
  createdAt: { type: Date, default: Date.now }
});
export const User = mongoose.model('User', UserSchema);