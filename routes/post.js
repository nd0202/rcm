// routes/posts.js
import express from "express";

import { User } from "../models/User.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import ffmpeg from "fluent-ffmpeg"; // ensure ffmpeg installed
import stream from "stream";
import { promisify } from "util";
import { Post } from "../models/post.js";

dotenv.config();

const pipeline = promisify(stream.pipeline);
const postRouter = express.Router();
const s3 = new S3Client({ region: process.env.AWS_REGION });

// POST /api/posts
// Expects: ownerId, title, description, media_key, media_type, thumbnail_key (optional)
postRouter.post("/posts", async (req, res) => {
  try {
    const { ownerId, title, description, media_key, media_type, thumbnail_key } = req.body;
    if (!ownerId || !media_key || !media_type) {
      return res.status(400).json({ error: "Missing ownerId, media_key or media_type" });
    }
     const user = await User.findById(ownerId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    const post = new Post({
       ownerId: user._id,
      userDetail: user,
      title: title || "",
      description: description || "",
      media_key,
      media_type,
      thumbnail_key: thumbnail_key || null,
      status: "processing",
    });

    await post.save();
    

    // If video and no thumbnail_key provided, attempt server-side thumbnail generation async-ish
    if (media_type === "video" && !thumbnail_key) {
      // spawn off async thumbnail generation but still respond to the client immediately
      generateThumbnailFromS3(media_key, post._id).catch(err => {
        console.error("Thumbnail generation failed:", err);
      });
    } else {
      // mark ready if image or thumbnail already provided
      post.status = "ready";
      await post.save();
    }

    // populate owner profile for response
    const populatedPost = await Post.findById(post._id)
      .populate("ownerId", "name avatar_url email")
      .exec();

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error("❌ Post save failed:", err);
    res.status(500).json({ error: "Failed to save post: " + err.message });
  }
});

// GET /api/posts - fetch latest posts populated with user profile
postRouter.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(100).populate("ownerId", "name avatar_url").lean();
    //res.json(posts);
    const bucket = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION;

const updatedPosts = posts.map(p => ({
  ...p,
  media_url: p.media_key
    ? `https://${bucket}.s3.${region}.amazonaws.com/${p.media_key}`
    : null,
  thumbnail_url: p.thumbnail_key
    ? `https://${bucket}.s3.${region}.amazonaws.com/${p.thumbnail_key}`
    : "",
}));

res.json(updatedPosts);
  } catch (err) {
    console.error("❌ Fetch posts failed:", err);
    res.status(500).json({ error: "Failed to fetch posts: " + err.message });
  }
});

export default postRouter;

/**
 * Helper: download video from S3, extract a thumbnail frame with ffmpeg,
 * upload thumbnail to S3, then update the post with thumbnail_key and status.
 */
async function generateThumbnailFromS3(mediaKey, postId) {
  console.log("📸 Generating thumbnail for", mediaKey, "post", postId);
  const bucket = process.env.S3_BUCKET_NAME;
  const tmpDir = path.resolve("./tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const videoTmpPath = path.join(tmpDir, `${Date.now()}-video`);
  const thumbnailPath = path.join(tmpDir, `${Date.now()}-thumb.jpg`);

  // Get object stream from S3
  const getCmd = new GetObjectCommand({ Bucket: bucket, Key: mediaKey });
  const s3Response = await s3.send(getCmd);
  const bodyStream = s3Response.Body; // readable stream

  // Save to temp file
  const writeStream = fs.createWriteStream(videoTmpPath);
  await pipeline(bodyStream, writeStream);

  // Extract thumbnail using ffmpeg: take frame at THUMBNAIL_EXTRACT_TIME_SECONDS (default 1s)
  const extractTime = parseInt(process.env.THUMBNAIL_EXTRACT_TIME_SECONDS || "1", 10);
  await new Promise((resolve, reject) => {
    ffmpeg(videoTmpPath)
      .screenshots({
        timestamps: [extractTime],
        filename: path.basename(thumbnailPath),
        folder: tmpDir,
        size: "640x?",
      })
      .on("end", resolve)
      .on("error", reject);
  });

  // Upload thumbnail to S3: place in thumbnails folder
  const thumbFilename = path.basename(thumbnailPath);
  const thumbKey = `thumbnails/${Date.now()}-${thumbFilename}`;

  const thumbBuffer = fs.readFileSync(thumbnailPath);
  const putCmd = new PutObjectCommand({
    Bucket: bucket,
    Key: thumbKey,
    Body: thumbBuffer,
    ContentType: "image/jpeg",
    ACL: "public-read", // optional
  });
  await s3.send(putCmd);

  // Update post record
  await Post.findByIdAndUpdate(postId, { thumbnail_key: thumbKey, status: "ready" });

  // cleanup temp files
  try { fs.unlinkSync(videoTmpPath); } catch (e) {}
  try { fs.unlinkSync(thumbnailPath); } catch (e) {}

  console.log("✅ Thumbnail generated & uploaded:", thumbKey);
}
