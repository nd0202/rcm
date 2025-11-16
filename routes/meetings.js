// routes/meetings.js
import express from 'express';

import { v4 as uuidv4 } from 'uuid';
import { Meeting } from '../models/meeting.js';
const meetingRouter = express.Router();

meetingRouter.post('/create', async (req, res) => {
  try {
    const { hostId, title } = req.body;
    const id = uuidv4();
    //const join_link = `${process.env.FRONTEND_BASE || 'http://localhost:8080'}/join/${id}`;
    const join_link = `myapp://join/${id}`;

    const m = await Meeting.create({ _id: id, hostId, title, join_link, active: true });
    res.json(m);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'create meeting failed' });
  }
});

meetingRouter.get('/:id', async (req, res) => {
  const m = await Meeting.findById(req.params.id).lean();
  if (!m) return res.status(404).json({ error: 'not found' });
  res.json(m);
});

export default meetingRouter;
