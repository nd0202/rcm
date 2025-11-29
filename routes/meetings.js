// // routes/meetings.js
// import express from 'express';

// import { v4 as uuidv4 } from 'uuid';
// import { Meeting } from '../models/meeting.js';
// const meetingRouter = express.Router();

// meetingRouter.post('/create', async (req, res) => {
//   try {
//     const { hostId, title } = req.body;
//     const id = uuidv4();
    
//     const join_link = `https://zoomlive.in/meet/${id}`;

//     const m = await Meeting.create({ _id: id, hostId, title, join_link, active: true });
//     res.json(m);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'create meeting failed' });
//   }
// });

// meetingRouter.get('/:id', async (req, res) => {
//   const m = await Meeting.findById(req.params.id).lean();
//   if (!m) return res.status(404).json({ error: 'not found' });
//   res.json(m);
// });

// export default meetingRouter;




import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Meeting } from '../models/meeting.js';


const meetingRouter = express.Router();


meetingRouter.post('/create', async (req, res) => {
try {
const { hostId, title } = req.body;
const id = uuidv4();
const join_link = `https://zoomlive.in/meet/${id}`;


const m = await Meeting.create({
_id: id,
hostId,
title,
join_link,
active: true,
// startedAt: new Date(),
// maxDurationMinutes: 30
});


res.status(201).json(m);
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


meetingRouter.post('/:id/host', async (req, res) => {
// change host (promote participant to host)
const { newHostId } = req.body;
const m = await Meeting.findById(req.params.id);
if (!m) return res.status(404).json({ error: 'not found' });
m.hostId = newHostId;
m.participants = (m.participants || []).map(p => ({ ...p.toObject(), isHost: p.id === newHostId }));
await m.save();
res.json({ success: true, meeting: m });
});


export default meetingRouter;