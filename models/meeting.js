// models/Meeting.js
import mongoose from 'mongoose';

const MeetingSchema = new mongoose.Schema({
  _id: String,
  hostId: String,
  title: String,
  join_link: String,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
export const Meeting = mongoose.model('Meeting', MeetingSchema);
