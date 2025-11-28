import mongoose from 'mongoose';


const ParticipantSchema = new mongoose.Schema({
id: String, // userId
socketId: String,
name: String,
avatar: String,
muted: { type: Boolean, default: false },
isHost: { type: Boolean, default: false }
});


const MeetingSchema = new mongoose.Schema({
_id: { type: String }, // use UUID (from routes)
hostId: { type: String, required: true },
title: { type: String },
join_link: { type: String },
active: { type: Boolean, default: true },
participants: { type: [ParticipantSchema], default: [] },
startedAt: { type: Date, default: Date.now },
maxDurationMinutes: { type: Number, default: 30 }
}, { timestamps: true });


export const Meeting = mongoose.model('Meeting', MeetingSchema);