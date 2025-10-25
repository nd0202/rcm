import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const presignRouter = express.Router();
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Generate presigned upload URL
presignRouter.post("/presign/upload", async (req, res) => {
  try {
    const { filename, contentType, folder } = req.body;
    const id = uuidv4();
    const key = `${folder}/${id}-${filename}`;

    const cmd = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });
    res.json({ key, url });
  } catch (err) {
    console.error("❌ Presign failed:", err);
    res.status(500).json({ error: "Presign failed" });
  }
});

export default presignRouter;



// routes/presign.js
// import express from "express";
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// import { v4 as uuidv4 } from "uuid";
// import dotenv from "dotenv";

// dotenv.config();
// const presignRouter = express.Router();
// const s3 = new S3Client({ region: process.env.AWS_REGION });

// presignRouter.post("/presign/upload", async (req, res) => {
//   try {
//     const { filename, contentType, folder } = req.body;
//     if (!filename || !contentType || !folder) {
//       return res.status(400).json({ error: "filename, contentType, and folder required" });
//     }
//     const id = uuidv4();
//     const key = `${folder}/${id}-${filename}`;

//     const cmd = new PutObjectCommand({
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: key,
//       ContentType: contentType,
//       //ACL: "private", // keep private and serve via signed urls or CloudFront
//     });

//     const url = await getSignedUrl(s3, cmd, { expiresIn: parseInt(process.env.PRESIGN_EXPIRES_SECONDS || "600") });

//     res.json({ key, url });
//   } catch (err) {
//     console.error("❌ Presign failed:", err);
//     res.status(500).json({ error: "Presign failed" });
//   }
// });

// export default presignRouter;
