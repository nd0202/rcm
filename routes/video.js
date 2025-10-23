import express from "express";
import { Video } from "../models/video.js"; // Fixed import path

const videoRouter = express.Router();

/**
 * POST /api/videos
 * Save uploaded video metadata after presigned S3 upload
 */
videoRouter.post("/videos", async (req, res) => {
  try {
    const { ownerId, title, source_key } = req.body;

    if (!ownerId || !source_key) {
      return res.status(400).json({ error: "Missing ownerId or source_key" });
    }

    // Construct the public S3 URL
    const video_url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${source_key}`;

    const video = new Video({
      ownerId,
      title: title || "Untitled Video",
      source_key,
      video_url,
      status: "ready",
    });

    await video.save();

    res.status(201).json({
      _id: video._id,
      ownerId: video.ownerId,
      title: video.title,
      source_key: video.source_key,
      video_url: video.video_url,
      status: video.status,
      createdAt: video.createdAt
    });
  } catch (err) {
    console.error("❌ Video save failed:", err);
    res.status(500).json({ error: "Failed to save video: " + err.message });
  }
});

/**
 * GET /api/videos
 * Fetch latest uploaded videos
 */
videoRouter.get("/videos", async (req, res) => { // Fixed route path
  try {
    const videos = await Video.find().sort({ createdAt: -1 }).limit(100);
    res.json(videos);
  } catch (err) {
    console.error("❌ Fetch videos failed:", err);
    res.status(500).json({ error: "Failed to fetch videos: " + err.message });
  }
});

export default videoRouter;