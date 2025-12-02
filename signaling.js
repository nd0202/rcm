


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
        if (!meetingId || !userId) return;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return;

        const isHost = meeting.hostId === userId;

        socket.join(meetingId);

        // ✅ FORCE HOST TO EXIST
        let hostParticipant = meeting.participants.find(
          p => p.id === meeting.hostId
        );

        if (!hostParticipant) {
          meeting.participants.push({
            id: meeting.hostId,
            socketId: null,
            name: "Host",
            avatar: null,
            muted: false,
            isHost: true,
          });
        }

        // ✅ HANDLE CURRENT USER
        let participant = meeting.participants.find(p => p.id === userId);

        if (!participant) {
          meeting.participants.push({
            id: userId,
            socketId: socket.id,
            name: name || (isHost ? "Host" : "User"),
            avatar: null,
            muted: false,
            isHost: isHost,
          });
        } else {
          participant.socketId = socket.id;

          // ✅ NEVER lose host role
          if (participant.id === meeting.hostId) {
            participant.isHost = true;
          }
        }

        await meeting.save();

        // ✅ SYNC PARTICIPANTS TO ALL
        io.to(meetingId).emit(
          "participants-updated",
          meeting.participants.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            muted: p.muted,
            isHost: p.isHost,
            socketId: p.socketId ?? null,
          }))
        );

        // ✅ WEBRTC EXISTING PEERS
        const room = io.sockets.adapter.rooms.get(meetingId);
        const existing = room
          ? Array.from(room).filter(id => id !== socket.id)
          : [];

        socket.emit("existing-peers", existing.map(id => ({ socketId: id })));

        socket.to(meetingId).emit("peer-joined", {
          userId,
          socketId: socket.id,
        });

        console.log(`✅ ${userId} joined meeting ${meetingId}`);
      } catch (err) {
        console.error("join error:", err);
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
