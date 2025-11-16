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

    // ------------------------------
    // JOIN MEETING
    // ------------------------------
    socket.on("join", ({ meetingId, userId }) => {
      console.log(`👤 User ${userId} joined meeting ${meetingId}`);

      socket.join(meetingId);

      // Notify others
      socket.to(meetingId).emit("peer-joined", {
        userId,
        socketId: socket.id,
      });
    });


    // ------------------------------
    // FORWARD SIGNALING (SDP / ICE)
    // ------------------------------
    socket.on("signal", ({ meetingId, targetSocketId, data }) => {
      if (!targetSocketId || !data) {
        console.log("⚠️ Invalid signal payload:", { meetingId, targetSocketId, data });
        return;
      }

      // Forward to specific peer
      io.to(targetSocketId).emit("signal", {
        from: socket.id,
        data,
      });
    });


    // ------------------------------
    // LEAVE MEETING
    // ------------------------------
    socket.on("leave", ({ meetingId, userId }) => {
      socket.leave(meetingId);

      console.log(`🚪 User ${userId} left meeting ${meetingId}`);

      socket.to(meetingId).emit("peer-left", {
        userId,
        socketId: socket.id,
      });
    });


    // ------------------------------
    // DISCONNECT
    // ------------------------------
    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);

      // Broadcast a leave event to all rooms the socket was part of
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
