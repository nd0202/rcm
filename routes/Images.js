// routes/posts.js
import express from 'express';
import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "crypto";
//import Post from '../models/Post.js';
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"; 
import { Image } from '../models/Image.js';



const imageRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({
  region: process.env.AWS_REGION ,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

imageRouter.post('/image', upload.single('image'), async (req, res) => {
  try {
    const { ownerId, text } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

    const key = `images/${randomUUID()}-${req.file.originalname}`;
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // const imageUrl = process.env.CLOUDFRONT_DOMAIN
    //   ? `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`
    //   : `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const Images = await Image.create({
      ownerId,
      type: 'image',
      image_url: imageUrl,
      text,
    });

    res.json(Images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

imageRouter.get('/', async (req, res) => {
  const Images = await Image.find().sort({ createdAt: -1 }).limit(100);
  res.json(Images);
});

export default imageRouter;
