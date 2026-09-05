"use client";

import { useState } from "react";

const initialForm = { name: "", description: "", price: "" };

const statusCopy = {
  published: {
    label: "Live in the store",
    tone: "text-moss border-moss/30 bg-moss/5",
  },
  review: {
    label: "Held for human review",
    tone: "text-amber border-amber/30 bg-amber/5",
  },
  rejected: {
    label: "Rejected",
    tone: "text-clay border-clay/30 bg-clay/5",
  },
  pending: {
    label: "Pending",
    tone: "text-ink/60 border-line bg-white",
  },
};

export default function ProductForm({
  initialData,
  onSubmit,
  submitLabel = "Submit listing",
  submittingLabel = "Checking listing…",
}) {
  const [form, setForm] = useState(
    initialData
      ? {
          name: initialData.name ?? "",
          description: initialData.description ?? "",
          price: initialData.price ?? "",
        }
      : initialForm
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initialData?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      // On create, an image is required. On edit, an existing image already
      // on file is fine — imageFile only needs to be set if the seller is
      // changing it.
      if (!initialData && !imageFile) {
        throw new Error("Please choose an image.");
      }

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("price", Number(form.price) || 0);
      if (imageFile) {
        formData.append("image", imageFile); // must match upload.single("image") on the backend
      }

      const saved = await onSubmit(formData);
      setResult(saved);
      if (!initialData) {
        setForm(initialForm);
        setImageFile(null);
        setImagePreview(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const status = result && (statusCopy[result.status] || statusCopy.pending);

  return (
    <div className="max-w-prose">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded border border-line bg-white p-4"
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="name">
            Item name
          </label>
          <input
            id="name"
            required
            value={form.name}
            onChange={update("name")}
            className="mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none"
            placeholder="Outdoor camping tool"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={form.description}
            onChange={update("description")}
            className="mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none"
            placeholder="What is it, what's it made of, what condition is it in?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="image">
            Item photo
          </label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink/50">
            Upload a clear photo of the actual item.
            {initialData ? " Leave empty to keep the current photo." : ""}
          </p>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="mt-2 h-32 w-32 rounded border border-line object-cover"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="price">
            Price ($)
          </label>
          <input
            id="price"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={update("price")}
            className="mt-1 w-40 rounded border border-line bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-mossDeep px-4 py-1.5 text-sm font-medium text-paper hover:bg-moss disabled:opacity-50"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          Something went wrong: {error}
        </div>
      )}

      {result && (
        <div className={`mt-6 rounded border px-4 py-3 text-sm ${status.tone}`}>
          <p className="font-medium">{status.label}</p>
          {result.reasoning && (
            <p className="mt-1 text-ink/70">{result.reasoning}</p>
          )}
          {result.classificationError && (
            <p className="mt-1 text-ink/70">
              Review check failed ({result.classificationError}) — a person
              will take a look.
            </p>
          )}
        </div>
      )}
    </div>
  );
}