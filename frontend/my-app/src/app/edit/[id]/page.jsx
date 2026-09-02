"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProductById, updateProduct } from "@/app/lib/api";
import ProductForm from "@/app/components/ProductForm";

export default function EditProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProductById(id)
      .then(setProduct)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <div className="mb-8 max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight">Edit listing</h1>
        <p className="mt-2 text-sm text-ink/70">
          Changing the description or image sends this listing back through
          automatic review.
        </p>
      </div>

      {loading && <p className="text-sm text-ink/60">Loading…</p>}
      {error && (
        <div className="rounded border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {product && (
        <ProductForm
          initialData={product}
          onSubmit={(data) => updateProduct(id, data)}
          submitLabel="Save changes"
          submittingLabel="Saving…"
        />
      )}
    </div>
  );
}