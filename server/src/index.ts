import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { GameManager } from "./game/GameManager";
import { GameSocketHandler } from "./sockets/gameSocket";
import { createGameRoutes } from "./routes/gameRoutes";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize game manager
const gameManager = new GameManager();
const gameSocketHandler = new GameSocketHandler(gameManager);

// Health check
app.get("/health", (_, res) => res.send("ok"));

// Game routes
app.use("/api", createGameRoutes(gameManager));

// Serve static files (for future frontend)
app.use(express.static("public"));

// Create HTTP server
const srv = http.createServer(app);

// Initialize Socket.IO
const io = new Server(srv, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

// Handle socket connections
io.on("connection", (socket) => {
  gameSocketHandler.handleConnection(socket);
});

// Cleanup inactive games every 30 minutes
setInterval(() => {
  gameManager.cleanupInactiveGames(30);
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
srv.listen(PORT, () => {
  console.log(`Muushig game server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/api`);
});
