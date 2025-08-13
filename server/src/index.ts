import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.get("/health", (_,res)=>res.send("ok"));

const srv = http.createServer(app);
const io = new Server(srv, { cors: { origin: "*" }});

io.of("/game").on("connection", (socket) => {
  socket.emit("hello", { id: socket.id });
});

srv.listen(3000, () => console.log("server on :3000"));
