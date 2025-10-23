// signaling.js
import { Server } from 'socket.io';

export default function startSignaling(server) {
  const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('join', ({ meetingId, userId }) => {
      console.log(`${userId} join ${meetingId}`);
      socket.join(meetingId);
      socket.to(meetingId).emit('peer-joined', { userId, socketId: socket.id });
    });

    socket.on('signal', ({ meetingId, payload }) => {
      // Forward to other members
      socket.to(meetingId).emit('signal', payload);
    });

    socket.on('leave', ({ meetingId }) => {
      socket.leave(meetingId);
      socket.to(meetingId).emit('peer-left', {});
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected', socket.id);
    });
  });

  console.log('Signaling ready');
}
