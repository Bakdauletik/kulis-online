const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { RoomManager } = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || "*" } });
const rooms = new RoomManager(io);
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/health", (_req,res)=>res.json({ok:true,service:"kulis-online"}));

io.on("connection", socket => {
  socket.emit("hello", {socketId:socket.id, protocol:1});
  socket.on("room:create", (data, ack) => safeAck(ack, () => rooms.create(socket, data || {})));
  socket.on("room:join", (data, ack) => safeAck(ack, () => rooms.join(socket, data || {})));
  socket.on("room:leave", (_data, ack) => safeAck(ack, () => rooms.leave(socket)));
  socket.on("game:start", (_data, ack) => safeAck(ack, () => rooms.start(socket)));
  socket.on("game:action", (data, ack) => safeAck(ack, () => rooms.action(socket, data || {})));
  socket.on("disconnect", () => rooms.disconnect(socket));
});
function safeAck(ack, fn) {
  try { const result=fn(); if(typeof ack==="function") ack({ok:true,...(result||{})}); }
  catch(e) { if(typeof ack==="function") ack({ok:false,error:e.message || "Қате"}); }
}
const port=process.env.PORT || 3000;
server.listen(port, ()=>console.log(`Kulis Online listening on ${port}`));
