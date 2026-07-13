import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { prisma } from "./server/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  app.use(express.json());

  // In-memory rate limiting map for incorrect room code attempts
  // Key: IP address, Value: { count: number, lastTried: number }
  const invalidAttempts = new Map<string, { count: number; lastTried: number }>();

  // Rate limiter helper
  const getClientIp = (req: express.Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
      return ip.trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  };

  const checkRateLimit = (ip: string) => {
    const record = invalidAttempts.get(ip);
    if (!record) return { allowed: true };

    const now = Date.now();
    const BAN_DURATION = 60 * 1000; // 1 minute lock

    if (record.count >= 5) {
      const timePassed = now - record.lastTried;
      if (timePassed < BAN_DURATION) {
        return { allowed: false, waitTime: Math.ceil((BAN_DURATION - timePassed) / 1000) };
      } else {
        // Reset count after ban period expires
        invalidAttempts.delete(ip);
      }
    }
    return { allowed: true };
  };

  const registerFailure = (ip: string) => {
    const record = invalidAttempts.get(ip);
    const now = Date.now();
    if (record) {
      record.count += 1;
      record.lastTried = now;
    } else {
      invalidAttempts.set(ip, { count: 1, lastTried: now });
    }
  };

  const registerSuccess = (ip: string) => {
    invalidAttempts.delete(ip);
  };

  // --- API ROUTES ---

  // Create Room
  app.post("/api/room/create", async (req, res) => {
    try {
      // Clean up empty rooms first
      const rooms = await prisma.room.findMany({
        include: { participants: true }
      });
      for (const room of rooms) {
        if (room.participants.length === 0) {
          await prisma.room.delete({ where: { code: room.code } });
        }
      }

      // Generate random unique 4 digit code
      let code = "";
      let attempts = 0;
      while (attempts < 10) {
        const candidate = Math.floor(1000 + Math.random() * 9000).toString();
        const existing = await prisma.room.findUnique({ where: { code: candidate } });
        if (!existing) {
          code = candidate;
          break;
        }
        attempts++;
      }

      if (!code) {
        return res.status(500).json({ error: "Failed to generate room code" });
      }

      const room = await prisma.room.create({
        data: { code }
      });

      return res.json({ code: room.code });
    } catch (err: any) {
      console.error("Create room error:", err);
      return res.status(500).json({ error: "Database error during room creation" });
    }
  });

  // Join Room
  app.post("/api/room/join", async (req, res) => {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Too many failed attempts. Please wait ${rateLimit.waitTime}s before trying again.`
      });
    }

    const { code, name } = req.body;

    if (!code || !name || name.trim() === "") {
      return res.status(400).json({ error: "Room code and nickname are required." });
    }

    const roomCode = code.trim();
    const nickname = name.trim();

    try {
      const room = await prisma.room.findUnique({
        where: { code: roomCode },
        include: { participants: true }
      });

      if (!room) {
        registerFailure(ip);
        return res.status(400).json({ error: "Invalid Room Code" });
      }

      // Clear rate limit counter on success
      registerSuccess(ip);

      // Check if participant is already inside the room (by nickname) to prevent duplicates or reconnect them
      const existingToken = req.headers["authorization"]?.replace("Bearer ", "") || "";
      let existingParticipant = null;

      if (existingToken) {
        existingParticipant = await prisma.participant.findFirst({
          where: { roomCode, sessionToken: existingToken }
        });
      }

      if (existingParticipant) {
        // Active session re-entry
        return res.json({
          sessionToken: existingParticipant.sessionToken,
          name: existingParticipant.name,
          roomCode
        });
      }

      // Check room full condition
      if (room.participants.length >= 2) {
        return res.status(400).json({ error: "Room Full" });
      }

      // Generate a secure session token
      const sessionToken = crypto.randomBytes(32).toString("hex");

      const participant = await prisma.participant.create({
        data: {
          name: nickname,
          roomCode,
          sessionToken
        }
      });

      // Broadcast update to anyone in the room
      io.to(roomCode).emit("participant-joined", {
        id: participant.id,
        name: participant.name,
        joinedAt: participant.joinedAt
      });

      return res.json({
        sessionToken: participant.sessionToken,
        name: participant.name,
        roomCode
      });
    } catch (err: any) {
      console.error("Join room error:", err);
      return res.status(500).json({ error: "Database error during join" });
    }
  });

  // Fetch current session details
  app.get("/api/room/session", async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No session token found" });
    }

    try {
      const participant = await prisma.participant.findUnique({
        where: { sessionToken: token },
        include: { room: { include: { participants: true } } }
      });

      if (!participant) {
        return res.status(401).json({ error: "Session expired or invalid" });
      }

      // Update activity timestamp
      await prisma.participant.update({
        where: { id: participant.id },
        data: { lastActive: new Date() }
      });

      return res.json({
        sessionToken: participant.sessionToken,
        name: participant.name,
        roomCode: participant.roomCode,
        room: {
          code: participant.room.code,
          participants: participant.room.participants.map(p => ({
            id: p.id,
            name: p.name,
            joinedAt: p.joinedAt
          }))
        }
      });
    } catch (err) {
      console.error("Session verification error:", err);
      return res.status(500).json({ error: "Database error during session lookup" });
    }
  });

  // Fetch messages manually (Refresh button)
  app.get("/api/room/messages", async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const participant = await prisma.participant.findUnique({
        where: { sessionToken: token }
      });

      if (!participant) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const messages = await prisma.message.findMany({
        where: { roomCode: participant.roomCode },
        orderBy: { createdAt: "asc" }
      });

      return res.json({ messages });
    } catch (err) {
      console.error("Fetch messages error:", err);
      return res.status(500).json({ error: "Failed to load messages" });
    }
  });

  // Logout
  app.post("/api/room/logout", async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token) {
      return res.json({ success: true }); // No-op if no token
    }

    try {
      const participant = await prisma.participant.findUnique({
        where: { sessionToken: token }
      });

      if (participant) {
        const roomCode = participant.roomCode;
        
        await prisma.participant.delete({
          where: { id: participant.id }
        });

        // Broadcast to other participant
        io.to(roomCode).emit("participant-left", {
          name: participant.name
        });

        // Delete room if no participants are left
        const remaining = await prisma.participant.count({
          where: { roomCode }
        });

        if (remaining === 0) {
          await prisma.message.deleteMany({ where: { roomCode } });
          await prisma.room.delete({ where: { code: roomCode } }).catch(() => {});
        }
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed on database" });
    }
  });

  // Clean inactive participants/rooms (running periodically)
  setInterval(async () => {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const expiredParticipants = await prisma.participant.findMany({
        where: { lastActive: { lt: thirtyMinutesAgo } }
      });

      for (const p of expiredParticipants) {
        console.log(`Auto-logout inactive user ${p.name} from room ${p.roomCode}`);
        await prisma.participant.delete({ where: { id: p.id } }).catch(() => {});
        io.to(p.roomCode).emit("participant-left", { name: p.name, reason: "inactivity" });

        // Clean up room if empty
        const count = await prisma.participant.count({ where: { roomCode: p.roomCode } });
        if (count === 0) {
          await prisma.message.deleteMany({ where: { roomCode: p.roomCode } }).catch(() => {});
          await prisma.room.delete({ where: { code: p.roomCode } }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Inactivity cron cleanup error:", err);
    }
  }, 60 * 1000); // Check every minute

  // --- WEBSOCKET CHAT STATE SYNCHRONIZATION (Socket.io) ---

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room real-time loop
    socket.on("join-room", async ({ roomCode, sessionToken }) => {
      if (!roomCode || !sessionToken) return;

      try {
        const participant = await prisma.participant.findUnique({
          where: { sessionToken }
        });

        if (participant && participant.roomCode === roomCode) {
          // Bind socket ID to current active participant
          await prisma.participant.update({
            where: { id: participant.id },
            data: { socketId: socket.id, lastActive: new Date() }
          });

          socket.join(roomCode);
          console.log(`User ${participant.name} joined Socket Room: ${roomCode}`);

          // Send current message history for initial sync
          const messages = await prisma.message.findMany({
            where: { roomCode },
            orderBy: { createdAt: "asc" }
          });

          const currentParticipants = await prisma.participant.findMany({
            where: { roomCode },
            select: { id: true, name: true, joinedAt: true }
          });

          socket.emit("room-state", {
            messages,
            participants: currentParticipants
          });

          // Notify other participants of join/reconnect
          socket.to(roomCode).emit("participant-joined", {
            id: participant.id,
            name: participant.name,
            joinedAt: participant.joinedAt
          });
        }
      } catch (err) {
        console.error("Socket join room error:", err);
      }
    });

    // Send Message
    socket.on("send-message", async ({ roomCode, sessionToken, content }) => {
      if (!roomCode || !sessionToken || !content || content.trim() === "") return;

      try {
        const participant = await prisma.participant.findUnique({
          where: { sessionToken }
        });

        if (participant && participant.roomCode === roomCode) {
          // Update activity check
          await prisma.participant.update({
            where: { id: participant.id },
            data: { lastActive: new Date() }
          });

          // Save message
          const savedMessage = await prisma.message.create({
            data: {
              roomCode,
              sender: participant.name,
              content: content.trim()
            }
          });

          // Broadcast to all sockets in the room, including sender
          io.to(roomCode).emit("message", savedMessage);
        }
      } catch (err) {
        console.error("Socket message saving error:", err);
      }
    });

    // Explicit Tab Hidden state heartbeat (to track if tab became hidden)
    socket.on("heartbeat", async ({ sessionToken }) => {
      if (!sessionToken) return;
      try {
        await prisma.participant.updateMany({
          where: { sessionToken },
          data: { lastActive: new Date() }
        });
      } catch (err) {
        // Ignore
      }
    });

    // Disconnection handler
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      try {
        // Reset socketId but do NOT immediately delete participant on momentary drop.
        // If they close the tab or log out, we clean them up.
        await prisma.participant.updateMany({
          where: { socketId: socket.id },
          data: { socketId: null }
        });
      } catch (err) {
        console.error("Socket disconnect handler database error:", err);
      }
    });
  });

  // --- VITE MIDDLEWARE & STATIC ASSET PIPELINE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
