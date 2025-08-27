// server/index.js
const express = require("express");
const cors = require("cors");
const hostaway = require("./routes/hostaway");

const PORT = process.env.PORT || 5000;

const server = express();

// CORS: allow your Vercel domain + local dev
const allowedOrigins = [
  process.env.FRONTEND_URL || "",       // e.g. https://your-app.vercel.app
  "http://localhost:5173"
];
server.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => o && origin.startsWith(o))) return cb(null, true);
    return cb(new Error("CORS blocked by server"), false);
  }
}));
server.use(express.json());

// Health check (handy on Render)
server.get("/", (_req, res) => {
  res.send("API is running ✅");
});

server.use("/api/reviews", hostaway);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});