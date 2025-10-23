// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import bodyParser from 'body-parser';
import presignRouter from './routes/presign.js';
import startSignaling from './signaling.js';
import { connectDB } from './config/db.js';
//import userRouter from './routes/user.js';
import meetingRouter from './routes/meetings.js';
//import authRouter from './routes/userAuth.js';
import imageRouter from './routes/Images.js';
import videoRouter from './routes/video.js';

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));


//app.use('/users', userRouter);
//app.use("/api/users", authRouter);

app.use('/api', imageRouter);

app.use('/api', presignRouter);
app.use('/api', videoRouter);
app.use('/meetings', meetingRouter);

app.get('/', (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
startSignaling(server);

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
