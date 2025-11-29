// import { Server } from 'socket.io';
// import { Meeting } from './models/meeting.js';

// let ioInstance = null;

// export default function startSignaling(server) {
//   const io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ['GET', 'POST'],
//       //credentials: true
//     }
//   });

//   // ✅ keep a module-level reference if other modules want to emit
//   ioInstance = io;

//   // ✅ SAFE public participant version (NO socketId leakage)
//   const publicParticipant = (p) => {
//     const doc = (p && typeof p.toObject === 'function') ? p.toObject() : p || {};
//     return {
//       id: doc.id,
//       name: doc.name,
//       avatar: doc.avatar,
//       muted: !!doc.muted,
//       isHost: !!doc.isHost
//     };
//   };

//   // ✅ Properly USED emitParticipants helper (no lint warning now)
//   const emitParticipants = async (meetingId) => {
//     const m = await Meeting.findById(meetingId);
//     if (!m) return;
//     io.to(meetingId).emit(
//       'participants-updated',
//       (m.participants || []).map(publicParticipant)
//     );
//   };

//   io.on('connection', (socket) => {
//     console.log('socket connected', socket.id);

//     // ✅ Prevent Duplicate Join Spam
//     socket.on('join', async ({ meetingId, userId  }) => {
//       try {
//         if ([...socket.rooms].includes(meetingId)) return;

//         socket.join(meetingId);

//         const m = await Meeting.findById(meetingId);
//         if (!m) {
//           socket.emit('error', { message: 'Meeting not found' });
//           return;
//         }

//         const existingParticipant = (m.participants || []).find(p => p.id === user.id);

//         if (!existingParticipant) {
//           m.participants.push({
//             id: user.id,
//             socketId: socket.id,
//             name: user.name,
//             avatar: user.avatar,
//             muted: false,
//             isHost: user.isHost || (m.hostId === user.id)
//           });
//         } else {
//           m.participants = (m.participants || []).map(p => {
//             const doc = (p && typeof p.toObject === 'function') ? p.toObject() : p;
//             if (doc.id === user.id) return { ...doc, socketId: socket.id };
//             return doc;
//           });
//         }

//         await m.save();
//         await emitParticipants(meetingId);

//         // ✅ Send existing peers for WebRTC signaling
//         const room = io.sockets.adapter.rooms.get(meetingId);
//         const existing = room ? Array.from(room).filter(id => id !== socket.id) : [];
//         socket.emit('existing-peers', existing.map(socketId => ({ socketId })));

//       } catch (err) {
//         console.error('join error', err);
//         socket.emit('error', { message: 'Join failed' });
//       }
//     });

//     socket.on('signal', ({ meetingId, targetSocketId, data }) => {
//       try {
//         if (targetSocketId) {
//           io.to(targetSocketId).emit('signal', { from: socket.id, data });
//         } else {
//           socket.to(meetingId).emit('signal', { from: socket.id, data });
//         }
//       } catch (err) {
//         console.error('signal error', err);
//         socket.emit('error', { message: 'Signal failed' });
//       }
//     });

//     socket.on('host-command', async ({ meetingId, cmd, payload }) => {
//       try {
//         const m = await Meeting.findById(meetingId);
//         if (!m) return;

//         const sender = (m.participants || []).find(p => {
//           const doc = (p && typeof p.toObject === 'function') ? p.toObject() : p;
//           return doc.socketId === socket.id;
//         });

//         if (!sender || sender.id !== m.hostId) {
//           socket.emit('error', { message: 'Only host is allowed to execute this command' });
//           return;
//         }

//         switch (cmd) {
//           case 'mute-all':
//             m.participants = m.participants.map(p => ({
//               ...p.toObject(),
//               muted: true
//             }));
//             await m.save();
//             await emitParticipants(meetingId);
//             io.to(meetingId).emit('muted-all');
//             break;

//           case 'unmute-all':
//             m.participants = m.participants.map(p => ({
//               ...p.toObject(),
//               muted: false
//             }));
//             await m.save();
//             await emitParticipants(meetingId);
//             io.to(meetingId).emit('unmuted-all');
//             break;

//           case 'promote': {
//             const { userId } = payload || {};
//             if (!userId) {
//               socket.emit('error', { message: 'promote requires userId' });
//               return;
//             }

//             m.hostId = userId;
//             m.participants = m.participants.map(p => ({
//               ...p.toObject(),
//               isHost: p.id === userId
//             }));

//             await m.save();
//             await emitParticipants(meetingId);
//             break;
//           }

//           case 'end':
//             m.active = false;
//             await m.save();
//             io.to(meetingId).emit('meeting-ended');
//             io.in(meetingId).socketsLeave(meetingId); // ✅ force cleanup
//             break;

//           default:
//             socket.emit('error', { message: 'Unknown command' });
//         }
//       } catch (err) {
//         console.error('host-command error', err);
//         socket.emit('error', { message: 'host-command failed' });
//       }
//     });

//     socket.on('leave', async ({ meetingId, userId }) => {
//       try {
//         socket.leave(meetingId);

//         const m = await Meeting.findById(meetingId);
//         if (!m) return;

//         if (userId === m.hostId) {
//           socket.emit('error', {
//             message: 'Host cannot leave. End meeting or promote someone else first.'
//           });
//           return;
//         }

//         m.participants = m.participants.filter(p => p.id !== userId);
//         await m.save();
//         await emitParticipants(meetingId);

//       } catch (err) {
//         console.error('leave error', err);
//         socket.emit('error', { message: 'Leave failed' });
//       }
//     });

//     // ✅ FULLY FIXED DISCONNECT LOGIC WITH AUTO HOST PROMOTION
//     socket.on('disconnect', async () => {
//       try {
//         const rooms = [...socket.rooms].filter(r => r !== socket.id);

//         for (const meetingId of rooms) {
//           const m = await Meeting.findById(meetingId);
//           if (!m) continue;

//           let newHostAssigned = false;

//           m.participants = m.participants.map(p => {
//             const doc = (p && typeof p.toObject === 'function') ? p.toObject() : p;

//             if (doc.socketId === socket.id) {
//               if (doc.isHost) newHostAssigned = true;
//               return { ...doc, socketId: null, isHost: false };
//             }

//             return doc;
//           });

//           if (newHostAssigned) {
//             const nextHost = m.participants.find(p => p.socketId);
//             if (nextHost) {
//               m.hostId = nextHost.id;
//               nextHost.isHost = true;
//             }
//           }

//           await m.save();
//           await emitParticipants(meetingId);
//         }
//       } catch (err) {
//         console.error('disconnect handling error', err);
//       }
//     });
//   });

//   console.log('✅ Signaling server ready');
//   return io;
// }

// // ✅ optional helper
// export function getIO() {
//   return ioInstance;
// }










// // signaling.js
// import { Server } from "socket.io";

// export default function startSignaling(server) {
//   const io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST"],
//     },
//   });

//   io.on("connection", (socket) => {
//     console.log("🟢 Socket connected:", socket.id);

//     // JOIN: add to room, reply with existing peers
//     socket.on("join", ({ meetingId, userId }) => {
//       console.log(`👤 User ${userId} joined meeting ${meetingId} (socket ${socket.id})`);
//       socket.join(meetingId);

//       // compute existing peers in room (exclude self)
//       const room = io.sockets.adapter.rooms.get(meetingId);
//       const existing = room ? Array.from(room).filter((id) => id !== socket.id) : [];

//       // send existing peers to the just-joined socket so it can offer to them
//       socket.emit("existing-peers", existing.map((socketId) => ({ socketId })));

//       // notify others that a new peer joined
//       socket.to(meetingId).emit("peer-joined", {
//         userId,
//         socketId: socket.id,
//       });
//     });

//     // SIGNAL: forward either to a target or broadcast to room
//     // Expected payload: { meetingId, targetSocketId?, data }
//     socket.on("signal", ({ meetingId, targetSocketId, data }) => {
//       if (!meetingId || !data) {
//         console.log("⚠️ Invalid signal payload:", { meetingId, targetSocketId, data });
//         return;
//       }

//       if (targetSocketId) {
//         // send to specific peer
//         io.to(targetSocketId).emit("signal", {
//           from: socket.id,
//           data,
//         });
//       } else {
//         // broadcast to all other members of room
//         socket.to(meetingId).emit("signal", {
//           from: socket.id,
//           data,
//         });
//       }
//     });

//     // LEAVE
//     socket.on("leave", ({ meetingId, userId }) => {
//       socket.leave(meetingId);
//       console.log(`🚪 User ${userId} left meeting ${meetingId} (socket ${socket.id})`);
//       socket.to(meetingId).emit("peer-left", {
//         userId,
//         socketId: socket.id,
//       });
//     });

//     // DISCONNECT -> broadcast to rooms the socket was in
//     socket.on("disconnect", () => {
//       console.log("🔴 Socket disconnected:", socket.id);
//       const rooms = [...socket.rooms].filter((r) => r !== socket.id);
//       rooms.forEach((meetingId) => {
//         socket.to(meetingId).emit("peer-left", {
//           socketId: socket.id,
//         });
//       });
//     });
//   });

//   console.log("🚀 Signaling server ready");
// }




// signaling.js
import { Server } from "socket.io";
import { Meeting } from "./models/meeting.js";

export default function startSignaling(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // ✅ JOIN MEETING + SAVE PARTICIPANT TO DB
    socket.on("join", async ({ meetingId, userId }) => {
      try {
        if (!meetingId || !userId) {
          socket.emit("error", { message: "Invalid join payload" });
          return;
        }

        console.log(`👤 User ${userId} joining ${meetingId}`);

        socket.join(meetingId);

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
          socket.emit("error", { message: "Meeting not found" });
          return;
        }

        // ✅ Check if user already exists
        let participant = meeting.participants.find(
          (p) => p.id === userId
        );

        if (!participant) {
          // ✅ NEW PARTICIPANT
          meeting.participants.push({
            id: userId,
            socketId: socket.id,
            name: "Mobile User",
            avatar: null,
            muted: false,
            isHost: meeting.hostId === userId,
          });
        } else {
          // ✅ RECONNECTED PARTICIPANT
          participant.socketId = socket.id;
        }

        await meeting.save();

        // ✅ Send updated participants to everyone
        io.to(meetingId).emit(
          "participants-updated",
          meeting.participants.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            muted: p.muted,
            isHost: p.isHost,
          }))
        );

        // ✅ Send existing peers for WebRTC
        const room = io.sockets.adapter.rooms.get(meetingId);
        const existing = room
          ? Array.from(room).filter((id) => id !== socket.id)
          : [];

        socket.emit(
          "existing-peers",
          existing.map((socketId) => ({ socketId }))
        );

        // ✅ Notify others
        socket.to(meetingId).emit("peer-joined", {
          userId,
          socketId: socket.id,
        });

        console.log("✅ Participant stored in DB");

      } catch (err) {
        console.error("❌ join error", err);
        socket.emit("error", { message: "Join failed" });
      }
    });

    // ✅ SIGNAL ROUTING
    socket.on("signal", ({ meetingId, targetSocketId, data }) => {
      if (!meetingId || !data) return;

      if (targetSocketId) {
        io.to(targetSocketId).emit("signal", {
          from: socket.id,
          data,
        });
      } else {
        socket.to(meetingId).emit("signal", {
          from: socket.id,
          data,
        });
      }
    });

    // ✅ LEAVE + REMOVE FROM DB
    socket.on("leave", async ({ meetingId, userId }) => {
      try {
        socket.leave(meetingId);

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        meeting.participants = meeting.participants.filter(
          (p) => p.id !== userId
        );

        await meeting.save();

        io.to(meetingId).emit(
          "participants-updated",
          meeting.participants.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            muted: p.muted,
            isHost: p.isHost,
          }))
        );

        socket.to(meetingId).emit("peer-left", {
          userId,
          socketId: socket.id,
        });

        console.log(`🚪 User ${userId} left ${meetingId}`);
      } catch (err) {
        console.error("❌ leave error", err);
      }
    });

    // ✅ DISCONNECT → AUTO REMOVE SOCKET FROM DB
    socket.on("disconnect", async () => {
      try {
        console.log("🔴 Socket disconnected:", socket.id);

        const meetings = await Meeting.find({
          "participants.socketId": socket.id,
        });

        for (const meeting of meetings) {
          let hostDisconnected = false;

          meeting.participants = meeting.participants.map((p) => {
            if (p.socketId === socket.id) {
              if (p.isHost) hostDisconnected = true;
              return { ...p.toObject(), socketId: null, isHost: false };
            }
            return p;
          });

          // ✅ Auto-promote new host if needed
          if (hostDisconnected) {
            const nextHost = meeting.participants.find(
              (p) => p.socketId
            );

            if (nextHost) {
              nextHost.isHost = true;
              meeting.hostId = nextHost.id;
            }
          }

          await meeting.save();

          io.to(meeting._id).emit(
            "participants-updated",
            meeting.participants.map((p) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              muted: p.muted,
              isHost: p.isHost,
            }))
          );

          socket.to(meeting._id).emit("peer-left", {
            socketId: socket.id,
          });
        }

      } catch (err) {
        console.error("❌ disconnect error", err);
      }
    });
  });

  console.log("🚀 Signaling server with DB participants is READY");
}
