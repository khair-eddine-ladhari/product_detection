// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/products.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://localhost:3000",
  "https://productdetection.vercel.app",
  /^https:\/\/productdetection-[a-z0-9]+-bahawebsite-s-projects\.vercel\.app$/,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests (curl, server-to-server, health checks)
    const isAllowed = allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );
    callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
  },
}));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/products", productRoutes);

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});