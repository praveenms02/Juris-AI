require("dotenv").config();

const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server: SocketIOServer } = require("socket.io");
const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const riskRoutes = require("./routes/riskRoutes");
const learningRoutes = require("./routes/learningRoutes");
const notesRoutes = require("./routes/notesRoutes");
const quizRoutes = require("./routes/quizRoutes");
const annotationRoutes = require("./routes/annotationRoutes");
const discussionRoutes = require("./routes/discussionRoutes");
const roomRoutes = require("./routes/roomRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { registerRoomSocket } = require("./sockets/roomSocket");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ── Security: Helmet (secure HTTP headers) ─────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,   // allow iframes in dev
    contentSecurityPolicy: false,       // configure separately if needed
  })
);

// ── Ensure uploads folder exists ───────────────────────────────────────────
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── CORS ───────────────────────────────────────────────────────────────────
const fromEnv = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...fromEnv, "http://localhost:5173", "http://127.0.0.1:5173"])];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// ── Rate Limiting ──────────────────────────────────────────────────────────
// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// ── Dev request logging ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "jurisai-backend",
    phase: 6,
    features: [
      "auth", "documents", "chat", "risk", "learning",
      "annotations", "discussions", "rooms", "realtime", "notifications",
    ],
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/annotations", annotationRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/notifications", notificationRoutes);

// ── JSON 404 for unknown API routes ───────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

// ── HTTP + Socket.IO server ────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Register Socket.IO handlers
registerRoomSocket(io);

// Make io accessible in controllers via req.app.get("io")
app.set("io", io);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 5010);

function findAvailablePort(startPort, attempts = 5) {
  return new Promise((resolve, reject) => {
    const tryPort = (port, remaining) => {
      const tester = net.createServer();
      tester.once("error", (err) => {
        tester.close();
        if (remaining <= 1) {
          reject(err);
          return;
        }
        tryPort(port + 1, remaining - 1);
      });
      tester.once("listening", () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, "127.0.0.1");
    };
    tryPort(startPort, attempts);
  });
}

async function start() {
  await connectDB();

  let port = PORT;
  try {
    port = await findAvailablePort(PORT);
  } catch (err) {
    console.error(`\nNo free port found near ${PORT} (EADDRINUSE).`);
    console.error(
      "Stop stale backend processes (`lsof -i :5010`) or set PORT in backend/.env, then match frontend/.env VITE_BACKEND_ORIGIN."
    );
    process.exit(1);
  }

  if (port !== PORT) {
    console.warn(`Port ${PORT} is busy. Using ${port} instead.`);
    console.warn(`Update frontend/.env: VITE_BACKEND_ORIGIN=http://127.0.0.1:${port}`);
  }

  httpServer.listen(port, "127.0.0.1", () => {
    console.log(`JurisAI backend listening on http://localhost:${port}`);
    console.log(`Socket.IO ready on ws://localhost:${port}`);
  });

  httpServer.on("error", (err) => {
    console.error("HTTP server error:", err);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
