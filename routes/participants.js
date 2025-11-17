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
