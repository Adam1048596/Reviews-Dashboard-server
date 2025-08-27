// server/index.js
const express = require("express");
const cors = require("cors");
const hostaway = require("./routes/hostaway");

const PORT = process.env.PORT || 5000;

const server = express();

// CORS: allow your Vercel domain + local dev
const allowedOrigins = "https://reviews-dashboard-92a1.vercel.app";

server.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) return cb(null, true);
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    
    // For subdomain matching (allows all *.vercel.app domains)
    if (origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }
    
    return cb(new Error("CORS blocked by server"), false);
  },
  credentials: true
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
