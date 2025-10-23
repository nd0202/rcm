import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
   password: String,
  avatar_url: String,
  createdAt: { type: Date, default: Date.now }
});
export const User = mongoose.model('User', UserSchema);
