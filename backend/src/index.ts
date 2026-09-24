import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import meetingsRoutes from './routes/meetings.routes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingsRoutes);

app.get('/', (_req, res) => {
  res.send('✅ Customer Meeting Platform backend is running');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

interface RoomUser {
  userName: string;
  isHost: boolean;
}

// roomId -> Map<socketId, RoomUser>
const rooms = new Map<string, Map<string, RoomUser>>();
// roomId -> Map<socketId, userName>  (customers waiting for host approval)
const pending = new Map<string, Map<string, string>>();

io.on('connection', (socket) => {
  // Host, or a customer already approved, joins the real meeting room
  socket.on('join-room', ({ roomId, userName, isHost }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const room = rooms.get(roomId)!;

    const existingUsers = Array.from(room.entries()).map(([id, info]) => ({
      socketId: id,
      userName: info.userName,
    }));
    socket.emit('existing-users', existingUsers);

    room.set(socket.id, { userName, isHost: !!isHost });
    (socket as any).roomId = roomId;
    (socket as any).userName = userName;
    (socket as any).isHost = !!isHost;

    socket.to(roomId).emit('user-joined', { socketId: socket.id, userName });
  });

  // Customer asks to join — waits until the host admits them
  socket.on('request-to-join', ({ roomId, userName }) => {
    if (!pending.has(roomId)) pending.set(roomId, new Map());
    pending.get(roomId)!.set(socket.id, userName);

    (socket as any).roomId = roomId;
    (socket as any).userName = userName;
    (socket as any).isPending = true;

    const room = rooms.get(roomId);
    if (room) {
      room.forEach((info, hostSocketId) => {
        if (info.isHost) {
          io.to(hostSocketId).emit('join-request', { socketId: socket.id, userName });
        }
      });
    }
  });

  // Host admits a waiting customer
  socket.on('admit', ({ roomId, socketId }) => {
    pending.get(roomId)?.delete(socketId);
    io.to(socketId).emit('join-approved');
  });

  // Host rejects a waiting customer
  socket.on('reject', ({ roomId, socketId }) => {
    pending.get(roomId)?.delete(socketId);
    io.to(socketId).emit('join-rejected');
  });

  socket.on('signal', ({ to, from, signal }) => {
    io.to(to).emit('signal', { from, signal });
  });

  socket.on('disconnect', () => {
    const roomId = (socket as any).roomId;
    if (!roomId) return;

    if (rooms.has(roomId)) {
      rooms.get(roomId)!.delete(socket.id);
      socket.to(roomId).emit('user-left', { socketId: socket.id });
    }
    if (pending.has(roomId)) {
      pending.get(roomId)!.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});