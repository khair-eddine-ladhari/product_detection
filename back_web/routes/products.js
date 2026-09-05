// server/src/routes/products.js
import { Router } from "express";
import multer from "multer";
import {
  createProduct,
  getStoreProducts,
  getAllProducts,
  getProductById,
  updateProductStatus,
  deleteProduct,
  updateProduct
} from "../controllers/productController.js";

// Store the upload in memory (as a Buffer) — we only need it briefly to
// convert to a base64 data URI in the controller, not to keep as a file
// on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB cap, adjust as needed
});

const router = Router();

router.post("/", upload.single("image"), createProduct);
router.get("/store", getStoreProducts);
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.patch("/:id/status", updateProductStatus);
router.delete("/:id", deleteProduct);

// ...existing routes...
router.patch("/:id", upload.single("image"), updateProduct); // add after /:id/status, order doesn't matter here since segment counts differ

export default router;