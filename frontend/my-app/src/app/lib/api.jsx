const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * These endpoints assume the standard REST shape on top of your existing
 * server/src/controllers/productController.js:
 *   GET   /api/products?status=published|review|rejected|pending
 *   POST  /api/products                 (create + trigger AI classification)
 *   PATCH /api/products/:id             (admin override of status)
 * If your routes differ, only this file needs to change.
 *
 * createProduct and updateProduct now send FormData (name, description,
 * price, and an "image" file field) instead of JSON, since the backend
 * uses multer to accept an actual uploaded image file. Do NOT set
 * Content-Type manually for FormData requests — the browser sets the
 * correct "multipart/form-data; boundary=..." header automatically, and
 * setting it by hand breaks the boundary.
 */

export async function getProducts(status) {
  const url = status
    ? `${API_BASE}/api/products?status=${encodeURIComponent(status)}`
    : `${API_BASE}/api/products`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return res.json();
}

export async function createProduct(formData) {
  const res = await fetch(`${API_BASE}/api/products`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to create product (${res.status})`);
  return res.json();
}

export async function updateProductStatus(id, status) {
  const res = await fetch(`${API_BASE}/api/products/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update product (${res.status})`);
  return res.json();
}

export async function updateProduct(id, formData) {
  const res = await fetch(`${API_BASE}/api/products/${id}`, {
    method: "PATCH",
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to update product (${res.status})`);
  return res.json();
}

export async function getProductById(id) {
  const res = await fetch(`${API_BASE}/api/products/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
  return res.json();
}