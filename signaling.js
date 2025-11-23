// // signaling.js
// import { Server } from 'socket.io';

// export default function startSignaling(server) {
//   const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

//   io.on('connection', (socket) => {
//     console.log('socket connected', socket.id);

//     socket.on('join', ({ meetingId, userId }) => {
//       console.log(`${userId} join ${meetingId}`);
//       socket.join(meetingId);
//       socket.to(meetingId).emit('peer-joined', { userId, socketId: socket.id });
//     });

//     socket.on('signal', ({ meetingId, payload }) => {
//       // Forward to other members
//       socket.to(meetingId).emit('signal', payload);
//     });

//     socket.on('leave', ({ meetingId }) => {
//       socket.leave(meetingId);
//       socket.to(meetingId).emit('peer-left', {});
//     });

//     socket.on('disconnect', () => {
//       console.log('socket disconnected', socket.id);
//     });
//   });

//   console.log('Signaling ready');
// }








// signaling.js
import { Server } from "socket.io";

export default function startSignaling(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // JOIN: add to room, reply with existing peers
    socket.on("join", ({ meetingId, userId }) => {
      console.log(`👤 User ${userId} joined meeting ${meetingId} (socket ${socket.id})`);
      socket.join(meetingId);

      // compute existing peers in room (exclude self)
      const room = io.sockets.adapter.rooms.get(meetingId);
      const existing = room ? Array.from(room).filter((id) => id !== socket.id) : [];

      // send existing peers to the just-joined socket so it can offer to them
      socket.emit("existing-peers", existing.map((socketId) => ({ socketId })));

      // notify others that a new peer joined
      socket.to(meetingId).emit("peer-joined", {
        userId,
        socketId: socket.id,
      });
    });

    // SIGNAL: forward either to a target or broadcast to room
    // Expected payload: { meetingId, targetSocketId?, data }
    socket.on("signal", ({ meetingId, targetSocketId, data }) => {
      if (!meetingId || !data) {
        console.log("⚠️ Invalid signal payload:", { meetingId, targetSocketId, data });
        return;
      }

      if (targetSocketId) {
        // send to specific peer
        io.to(targetSocketId).emit("signal", {
          from: socket.id,
          data,
        });
      } else {
        // broadcast to all other members of room
        socket.to(meetingId).emit("signal", {
          from: socket.id,
          data,
        });
      }
    });

    // LEAVE
    socket.on("leave", ({ meetingId, userId }) => {
      socket.leave(meetingId);
      console.log(`🚪 User ${userId} left meeting ${meetingId} (socket ${socket.id})`);
      socket.to(meetingId).emit("peer-left", {
        userId,
        socketId: socket.id,
      });
    });

    // DISCONNECT -> broadcast to rooms the socket was in
    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
      const rooms = [...socket.rooms].filter((r) => r !== socket.id);
      rooms.forEach((meetingId) => {
        socket.to(meetingId).emit("peer-left", {
          socketId: socket.id,
        });
      });
    });
  });

  console.log("🚀 Signaling server ready");
}
