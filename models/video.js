// models/Video.js
// import mongoose from 'mongoose';

// const VideoSchema = new mongoose.Schema({
//   _id: String,
//   ownerId: String,
//   source_key: String,
//   hls_master_url: String,
//   thumbnail_url: String,
//   title: String,
//   status: { type: String, default: 'processing' },
//   createdAt: { type: Date, default: Date.now }
// });
// export const Video = mongoose.model('Video', VideoSchema);



// import mongoose from "mongoose";

// const VideoSchema = new mongoose.Schema({
//   _id: {
//     type: String,
//     default: () => new mongoose.Types.ObjectId().toString(),
//   },
//   ownerId: {
//     type: String,
//     required: true,
//   },
//   title: {
//     type: String,
//     default: "Untitled Video",
//   },
//   source_key: {
//     type: String,
//     required: true,
//   },
//   video_url: {
//     type: String,
//     required: true,
//   },
//   hls_master_url: {
//     type: String,
//     default: null,
//   },
//   thumbnail_url: {
//     type: String,
//     default: null,
//   },
//   status: {
//     type: String,
//     enum: ["processing", "ready", "failed"],
//     default: "processing",
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// export const Video = mongoose.model("Video", VideoSchema);




