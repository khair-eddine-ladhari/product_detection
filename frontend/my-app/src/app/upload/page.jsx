"use client";

import { createProduct } from "@/app/lib/api";
import ProductForm from "@/app/components/ProductForm";

export default function UploadPage() {
  return (
    <div>
      <div className="mb-8 max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight">Sell an item</h1>
        <p className="mt-2 text-sm text-ink/70">
          Every listing runs through automatic review before it appears in the
          store. Most clear in a few seconds.
        </p>
      </div>
      <ProductForm onSubmit={createProduct} />
    </div>
  );
}