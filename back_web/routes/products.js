// server/src/routes/products.js
import { Router } from "express";
import {
  createProduct,
  getStoreProducts,
  getAllProducts,
  getProductById,
  updateProductStatus,
  deleteProduct,
} from "../controllers/productController.js";

const router = Router();

router.post("/", createProduct);
router.get("/store", getStoreProducts);
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.patch("/:id/status", updateProductStatus);
router.delete("/:id", deleteProduct);

export default router;