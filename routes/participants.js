import express from "express";
import { Meeting } from "../models/meeting.js";


const participantsRouter = express.Router();

participantsRouter.get("/:id/participants", async (req, res) => {
  const m = await Meeting.findById(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  res.json(m.participants || []);
});

participantsRouter.post("/:id/start", async (req, res) => {
  const m = await Meeting.findById(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  m.active = true;
  await m.save();
  res.json({ success: true });
});

participantsRouter.post("/:id/end", async (req, res) => {
  const m = await Meeting.findById(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  m.active = false;
  await m.save();
  res.json({ success: true });
});

participantsRouter.post("/:id/leave", async (req, res) => {
  const m = await Meeting.findById(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  const { userId } = req.body;
  m.participants = (m.participants || []).filter(p => p.id !== userId);
  await m.save();
  res.json({ success: true });
});

export default participantsRouter;







// import express from 'express';
// import { Meeting } from '../models/meeting.js';
// //import { verifyToken } from '../middleware/auth.js';



// const participantsRouter = express.Router();


// participantsRouter.get('/:id/participants', async (req, res) => {
// const m = await Meeting.findById(req.params.id).lean();
// if (!m) return res.status(404).json({ error: 'not found' });
// res.json(m.participants || []);
// });


// participantsRouter.post('/:id/start', async (req, res) => {
// const m = await Meeting.findById(req.params.id);
// if (!m) return res.status(404).json({ error: 'not found' });
// m.active = true;
// m.startedAt = m.startedAt || new Date();
// await m.save();
// res.json({ success: true });
// });


// participantsRouter.post('/:id/end', async (req, res) => {
// // only host can end
// const m = await Meeting.findById(req.params.id);
// if (!m) return res.status(404).json({ error: 'not found' });
// if (m.hostId !== req.user.id) return res.status(403).json({ error: 'only host can end meeting' });
// m.active = false;
// await m.save();
// res.json({ success: true });
// });


// participantsRouter.post('/:id/mute', async (req, res) => {
// const { userId } = req.body; // participant to mute
// const m = await Meeting.findById(req.params.id);
// if (!m) return res.status(404).json({ error: 'not found' });
// if (m.hostId !== req.user.id) return res.status(403).json({ error: 'only host can mute' });
// m.participants = (m.participants || []).map(p => p.id === userId ? { ...p.toObject(), muted: true } : p);
// await m.save();
// res.json({ success: true });
// });


// participantsRouter.post('/:id/unmute', async (req, res) => {
// const { userId } = req.body;
// const m = await Meeting.findById(req.params.id);
// if (!m) return res.status(404).json({ error: 'not found' });
// if (m.hostId !== req.user.id) return res.status(403).json({ error: 'only host can unmute' });
// m.participants = (m.participants || []).map(p => p.id === userId ? { ...p.toObject(), muted: false } : p);
// await m.save();
// res.json({ success: true });
// });


// participantsRouter.post('/:id/leave', async (req, res) => {
// const { userId } = req.body;
// const m = await Meeting.findById(req.params.id);
// if (!m) return res.status(404).json({ error: 'not found' });
// // host cannot leave without promoting another host or ending
// if (userId === m.hostId) return res.status(400).json({ error: 'host cannot leave; end meeting or promote another host first' });


// m.participants = (m.participants || []).filter(p => p.id !== userId);
// await m.save();
// res.json({ success: true });
// });


// export default participantsRouter;