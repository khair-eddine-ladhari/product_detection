import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Calls the FastAPI /classify endpoint. Throws on network/5xx failure so
 * the caller can decide how to handle it.
 *
 * Actual back_ai response shape:
 * {
 *   product_id, flagged, category, confidence (0-1 float), reasoning,
 *   text_image_mismatch, requires_human_review, review_notes, status
 * }
 */
export async function classifyProduct({ id, name, description, imageUrl }) {
  try {
    const { data } = await axios.post(
      `${AI_SERVICE_URL}/classify`,
      { id, name, description, image_url: imageUrl },
      { timeout: 180_000 }
    );
    return { 
      flagged: data.flagged,
      category: data.category,
      textImageMismatch: data.textImageMismatch,
      confidence: data.confidence, 
      reasoning: data.reasoning,
      requiresHumanReview: data.requiresHumanReview,
      aiStatus: data.status,
    };
  } catch (err) {
    console.error("AI service validation error:", err.response?.data);
    throw err;
  }
}
/** Maps the AI service's verdict to a store-facing status. */
export function statusFromDecision({ flagged, requiresHumanReview }) {
  if (requiresHumanReview) return "review";
  if (flagged) return "rejected";
  return "published";
}