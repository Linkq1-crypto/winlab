import express from "express";
import http from "http";
import labRoutes from "../modules/labs/routes.js";
import authRoutes from "../modules/auth/routes.js";
import { authMiddleware } from "./auth.js";
import { initTerminal } from "../websocket/terminal.js";

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/labs", authMiddleware, labRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

initTerminal(server);

server.listen(3000, () => {
  console.log("API running on port 3000");
});
