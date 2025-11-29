


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
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // ------------------------
    // JOIN
    // payload: { meetingId, userId, name }
    // ------------------------
    socket.on("join", async ({ meetingId, userId, name }) => {
      try {
        if (!meetingId || !userId) {
          socket.emit("error", { message: "join requires meetingId and userId" });
          return;
        }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
          socket.emit("error", { message: "meeting not found" });
          return;
        }

        const isHost = meeting.hostId === userId;

        // If meeting is locked and this is not the host, put into waiting room
        if (meeting.locked && !isHost) {
          const alreadyWaiting = (meeting.waitingRoom || []).some(w => w.id === userId);
          if (!alreadyWaiting) {
            meeting.waitingRoom = meeting.waitingRoom || [];
            meeting.waitingRoom.push({
              id: userId,
              socketId: socket.id,
              name: name || "Guest",
              avatar: null,
              muted: false,
              isHost: false,
            });
            await meeting.save();
          }

          // notify host only
          const host = meeting.participants.find(p => p.isHost);
          if (host?.socketId) {
            io.to(host.socketId).emit("waiting-room-update", meeting.waitingRoom);
          }

          socket.emit("waiting", { message: "Meeting locked — waiting for approval" });
          console.log(`🔒 ${userId} added to waiting room for ${meetingId}`);
          return;
        }

        // join socket.io room
        socket.join(meetingId);

        // find participant (may be placeholder)
        let participant = (meeting.participants || []).find(p => p.id === userId);

        // If host is defined in meeting.hostId but not present in participants, add placeholder for host
        if (!participant && isHost) {
          participant = {
            id: userId,
            socketId: socket.id,
            name: name || "Host",
            avatar: null,
            muted: false,
            isHost: true,
          };
          meeting.participants = meeting.participants || [];
          meeting.participants.push(participant);
        } else if (!participant) {
          // normal new participant
          participant = {
            id: userId,
            socketId: socket.id,
            name: name || "User",
            avatar: null,
            muted: false,
            isHost: !!isHost,
          };
          meeting.participants = meeting.participants || [];
          meeting.participants.push(participant);
        } else {
          // reconnect/update existing participant
          participant.socketId = socket.id;
          participant.isHost = !!isHost;
        }

        await meeting.save();

        // broadcast participants
        io.to(meetingId).emit("participants-updated", (meeting.participants || []).map(p => ({
          id: p.id,
          name: p.name || "Unknown",
          avatar: p.avatar || null,
          muted: !!p.muted,
          isHost: !!p.isHost,
          socketId: p.socketId || null,
        })));

        // webRTC: send existing peers (socket ids) to the new socket
        const room = io.sockets.adapter.rooms.get(meetingId);
        const existing = room ? Array.from(room).filter(id => id !== socket.id) : [];
        socket.emit("existing-peers", existing.map(id => ({ socketId: id })));

        // notify others someone joined
        socket.to(meetingId).emit("peer-joined", { userId, socketId: socket.id });

        console.log(`✅ ${userId} joined meeting ${meetingId} (socket ${socket.id})`);
      } catch (err) {
        console.error("join error:", err);
        socket.emit("error", { message: "join failed" });
      }
    });

    // ------------------------
    // APPROVE USER FROM WAITING ROOM (host only)
    // payload: { meetingId, userId }
    // ------------------------
    socket.on("approve-user", async ({ meetingId, userId }) => {
      try {
        if (!meetingId || !userId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const host = (meeting.participants || []).find(p => p.isHost);
        if (!host || host.socketId !== socket.id) return; // only host

        const waiting = (meeting.waitingRoom || []).find(w => w.id === userId);
        if (!waiting) return;

        // remove from waiting and add to participants
        meeting.waitingRoom = (meeting.waitingRoom || []).filter(w => w.id !== userId);
        meeting.participants = meeting.participants || [];
        meeting.participants.push({
          id: waiting.id,
          socketId: waiting.socketId,
          name: waiting.name || "User",
          avatar: null,
          muted: false,
          isHost: false,
        });

        await meeting.save();

        // notify the approved user
        if (waiting.socketId) {
          io.to(waiting.socketId).emit("approved", { meetingId });
        }

        // update everyone
        io.to(meetingId).emit("participants-updated", meeting.participants);
        console.log(`✅ Approved ${userId} into meeting ${meetingId}`);
      } catch (err) {
        console.error("approve-user error:", err);
      }
    });

    // ------------------------
    // KICK USER (host only)
    // payload: { meetingId, userId }
    // ------------------------
    socket.on("kick-user", async ({ meetingId, userId }) => {
      try {
        if (!meetingId || !userId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const host = (meeting.participants || []).find(p => p.isHost);
        if (!host || host.socketId !== socket.id) return; // only host

        const user = (meeting.participants || []).find(p => p.id === userId);
        if (!user) return;

        // remove from participants
        meeting.participants = (meeting.participants || []).filter(p => p.id !== userId);
        await meeting.save();

        // notify kicked user
        if (user.socketId) {
          io.to(user.socketId).emit("kicked", { meetingId });
        }

        io.to(meetingId).emit("participants-updated", meeting.participants);
        console.log(`🗑️ Kicked ${userId} from ${meetingId}`);
      } catch (err) {
        console.error("kick-user error:", err);
      }
    });

    // ------------------------
    // MUTE ALL (host only)
    // payload: { meetingId }
    // ------------------------
    socket.on("mute-all", async ({ meetingId }) => {
      try {
        if (!meetingId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const host = (meeting.participants || []).find(p => p.isHost);
        if (!host || host.socketId !== socket.id) return;

        (meeting.participants || []).forEach(p => {
          if (!p.isHost) p.muted = true;
        });

        await meeting.save();
        io.to(meetingId).emit("participants-updated", meeting.participants);
        io.to(meetingId).emit("mute-all");
        console.log(`🔇 Mute all in ${meetingId}`);
      } catch (err) {
        console.error("mute-all error:", err);
      }
    });

    // ------------------------
    // LOCK / UNLOCK MEETING (host only)
    // payload: { meetingId, lock } (lock = true/false)
    // ------------------------
    socket.on("lock-meeting", async ({ meetingId, lock = true }) => {
      try {
        if (!meetingId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const host = (meeting.participants || []).find(p => p.isHost);
        if (!host || host.socketId !== socket.id) return;

        meeting.locked = !!lock;
        await meeting.save();
        io.to(meetingId).emit("meeting-locked", { locked: meeting.locked });
        console.log(`🔒 Meeting ${meetingId} locked=${meeting.locked}`);
      } catch (err) {
        console.error("lock-meeting error:", err);
      }
    });

    // ------------------------
    // END MEETING (host only)
    // payload: { meetingId }
    // ------------------------
    socket.on("end-meeting", async ({ meetingId }) => {
      try {
        if (!meetingId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const host = (meeting.participants || []).find(p => p.isHost);
        if (!host || host.socketId !== socket.id) return;

        meeting.active = false;
        meeting.participants = [];
        meeting.waitingRoom = [];
        await meeting.save();

        io.to(meetingId).emit("meeting-ended", { meetingId });
        console.log(`🛑 Meeting ${meetingId} ended by host`);
      } catch (err) {
        console.error("end-meeting error:", err);
      }
    });

    // ------------------------
    // MAKE HOST (host only)
    // payload: { meetingId, newHostId }
    // ------------------------
    socket.on("make-host", async ({ meetingId, newHostId }) => {
      try {
        if (!meetingId || !newHostId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const currentHost = (meeting.participants || []).find(p => p.isHost);
        const nextHost = (meeting.participants || []).find(p => p.id === newHostId);
        if (!currentHost || !nextHost) return;

        currentHost.isHost = false;
        nextHost.isHost = true;
        meeting.hostId = newHostId;
        await meeting.save();

        // force leave the old host client if connected
        if (currentHost.socketId) {
          io.to(currentHost.socketId).emit("force-leave", { reason: "host-transferred" });
        }

        io.to(meetingId).emit("participants-updated", meeting.participants);
        console.log(`👑 Host transferred to ${newHostId} in ${meetingId}`);
      } catch (err) {
        console.error("make-host error:", err);
      }
    });

    // ------------------------
    // INTENTIONAL LEAVE (client should call this when user clicks Leave)
    // payload: { meetingId, userId }
    // ------------------------
    socket.on("leave", async ({ meetingId, userId }) => {
      try {
        if (!meetingId || !userId) return;
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const participant = (meeting.participants || []).find(p => p.id === userId);
        if (!participant) return;

        if (participant.isHost) {
          // host cannot intentionally leave; require transfer first
          socket.emit("error", { message: "Host cannot leave without transferring host" });
          console.log("⛔ Host attempted intentional leave without transfer");
          return;
        }

        meeting.participants = (meeting.participants || []).filter(p => p.id !== userId);
        await meeting.save();

        socket.leave(meetingId);
        io.to(meetingId).emit("participants-updated", meeting.participants);
        socket.to(meetingId).emit("peer-left", { userId, socketId: socket.id });

        console.log(`🚪 ${userId} intentionally left ${meetingId}`);
      } catch (err) {
        console.error("leave error:", err);
      }
    });

    // ------------------------
    // SIGNAL forwarding
    // payload: { meetingId, targetSocketId?, data }
    // ------------------------
    socket.on("signal", ({ meetingId, targetSocketId, data }) => {
      if (!meetingId || !data) return;
      if (targetSocketId) {
        io.to(targetSocketId).emit("signal", { from: socket.id, data });
      } else {
        socket.to(meetingId).emit("signal", { from: socket.id, data });
      }
    });

    // ------------------------
    // DISCONNECT (unexpected)
    // - keep host role, clear socketId
    // - remove normal participants
    // ------------------------
    socket.on("disconnect", async () => {
      try {
        const meetings = await Meeting.find({ "participants.socketId": socket.id });
        for (const meeting of meetings) {
          const leaving = (meeting.participants || []).find(p => p.socketId === socket.id);
          if (!leaving) continue;

          if (leaving.isHost) {
            // Host disconnected unexpectedly (network/tab close/refresh)
            // Clear socketId but keep host role intact so host can rejoin
            leaving.socketId = null;
            // do NOT unset isHost or remove participant
            console.log(`⚠️ Host disconnected unexpectedly for meeting ${meeting._id} (cleared socketId)`);
          } else {
            // Remove normal participant
            meeting.participants = meeting.participants.filter(p => p.socketId !== socket.id);
            console.log(`➡️ Removed participant ${leaving.id} (socket ${socket.id}) from ${meeting._id}`);
          }

          await meeting.save();

          // emit participant update (note: host may still be present with socketId=null)
          io.to(meeting._id.toString()).emit("participants-updated", (meeting.participants || []).map(p => ({
            id: p.id,
            name: p.name || "Unknown",
            avatar: p.avatar || null,
            muted: !!p.muted,
            isHost: !!p.isHost,
            socketId: p.socketId || null,
          })));

          socket.to(meeting._id.toString()).emit("peer-left", { socketId: socket.id });
        }
      } catch (err) {
        console.error("disconnect handling error:", err);
      }
    });
  });

  console.log("🚀 Signaling server (full control) ready");
}
