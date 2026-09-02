// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/products.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/products", productRoutes);

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});