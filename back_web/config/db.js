import mongoose from "mongoose";

export async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log("[db] connected to MongoDB");
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }
}