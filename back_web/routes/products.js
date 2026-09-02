// server/src/routes/products.js
import { Router } from "express";
import {
  createProduct,
  getStoreProducts,
  getAllProducts,
  getProductById,
  updateProductStatus,
  deleteProduct,
  updateProduct
} from "../controllers/productController.js";




const router = Router();

router.post("/", createProduct);
router.get("/store", getStoreProducts);
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.patch("/:id/status", updateProductStatus);
router.delete("/:id", deleteProduct);





// ...existing routes...
router.patch("/:id", updateProduct); // add after /:id/status, order doesn't matter here since segment counts differ

export default router;