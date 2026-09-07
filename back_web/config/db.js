import dns from "dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[db] connected");
  } catch (err) {
    console.error(`[db] connection failed: ${err.message}`);
    throw err;
  }
}