import Product from "../models/Product.js";
import { classifyProduct, statusFromDecision } from "../services/aiService.js";

/**
 * Converts a multer in-memory uploaded file into a base64 data URI, which
 * is exactly the format classification_agent.py's _image_file_from_source()
 * already knows how to decode (see the "data:" branch there) — no changes
 * needed on the Python side.
 */
function fileToDataUri(file) {
  const base64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${base64}`;
}

// POST /api/products — create + classify a new product
export async function createProduct(req, res) {
  const { name, description, price } = req.body;
  const imageUrl = req.file ? fileToDataUri(req.file) : req.body.imageUrl;

  if (!name || !description || !imageUrl) {
    return res.status(400).json({ error: "name, description and image are required" });
  }

  try {
    const product = await Product.create({ name, description, imageUrl, price });

    try {
      const result = await classifyProduct({
        id: product._id.toString(),
        name,
        description,
        imageUrl,
      });

      product.flagged = result.flagged;
      product.category = result.category;
      product.textImageMismatch = result.textImageMismatch;
      product.confidence = result.confidence;
      product.reasoning = result.reasoning;
      product.status = statusFromDecision(result);
    } catch (aiErr) {
      product.status = "review";
      product.classificationError = aiErr.message;
    }

    await product.save();
    return res.status(201).json(product);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/products/store — only published, storefront-safe products
export async function getStoreProducts(req, res) {
  const products = await Product.find({ status: "published" }).sort({ createdAt: -1 });
  res.json(products);
}

// GET /api/products — full admin list, optional ?status= filter
export async function getAllProducts(req, res) {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json(products);
}

// GET /api/products/:id
export async function getProductById(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
}

// PATCH /api/products/:id/status — moderator override (approve/reject a "review" item)
export async function updateProductStatus(req, res) {
  const { status } = req.body;
  if (!["published", "rejected", "review"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
}

// DELETE /api/products/:id
export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ deleted: true });
}

// PATCH /api/products/:id — seller edits their own listing
export async function updateProduct(req, res) {
  const { name, description, price } = req.body;
  const uploadedImageUrl = req.file ? fileToDataUri(req.file) : req.body.imageUrl;

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const needsReclassification =
      (name !== undefined && name !== product.name) ||
      (description !== undefined && description !== product.description) ||
      (uploadedImageUrl !== undefined && uploadedImageUrl !== product.imageUrl);

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (uploadedImageUrl !== undefined) product.imageUrl = uploadedImageUrl;
    if (price !== undefined) product.price = price;

    if (needsReclassification) {
      try {
        const result = await classifyProduct({
          id: product._id.toString(),
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
        });

        product.flagged = result.flagged;
        product.category = result.category;
        product.textImageMismatch = result.textImageMismatch;
        product.confidence = result.confidence;
        product.reasoning = result.reasoning;
        product.status = statusFromDecision(result);
        product.classificationError = undefined;
      } catch (aiErr) {
        product.status = "review";
        product.classificationError = aiErr.message;
      }
    }

    await product.save();
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}