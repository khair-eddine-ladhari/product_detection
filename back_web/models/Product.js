import mongoose from "mongoose";

const { Schema } = mongoose;

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    price: { type: Number, default: 0 },

    // --- filled in by the AI service after classification ---
    status: {
      type: String,
      enum: ["pending", "published", "review", "rejected"],
      default: "pending",
    },
    flagged: { type: Boolean, default: false },
    category: { type: String, default: "none" },
    textImageMismatch: { type: Boolean, default: false },
    confidence: { type: Number, default: 0 },
    reasoning: { type: String, default: "" },
    decision: { type: String, default: null }, // auto_reject | human_review | clear
    imageValid: { type: Boolean, default: true },

    classificationError: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Product", ProductSchema);