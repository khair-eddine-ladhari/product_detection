"use client";

import { useState } from "react";

const initialForm = { name: "", description: "", price: "" };

const statusCopy = {
  published: {
    label: "Live in the store",
    dot: "bg-black",
  },
  review: {
    label: "Held for human review",
    dot: "bg-black/50",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-black/30",
  },
  pending: {
    label: "Pending",
    dot: "bg-black/30",
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
      <form onSubmit={handleSubmit} className="space-y-6 bg-white">
        <div>
          <label className="text-[13px] font-medium text-black" htmlFor="name">
            Item name
          </label>
          <input
            id="name"
            required
            value={form.name}
            onChange={update("name")}
            className="mt-1.5 w-full border-0 border-b border-black/15 bg-white px-0 py-2 text-sm text-black placeholder:text-black/30 focus:border-black focus:outline-none"
            placeholder="Outdoor camping tool"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-black" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={form.description}
            onChange={update("description")}
            className="mt-1.5 w-full border-0 border-b border-black/15 bg-white px-0 py-2 text-sm text-black placeholder:text-black/30 focus:border-black focus:outline-none"
            placeholder="What is it, what's it made of, what condition is it in?"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-black" htmlFor="image">
            Item photo
          </label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-1.5 w-full text-sm text-black file:mr-3 file:border file:border-black/15 file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:text-black hover:file:border-black"
          />
          <p className="mt-1.5 text-xs text-black/40">
            Upload a clear photo of the actual item.
            {initialData ? " Leave empty to keep the current photo." : ""}
          </p>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="mt-3 h-32 w-32 object-cover"
            />
          )}
        </div>

        <div>
          <label className="text-[13px] font-medium text-black" htmlFor="price">
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
            className="mt-1.5 w-40 border-0 border-b border-black/15 bg-white px-0 py-2 text-sm text-black focus:border-black focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="border border-black bg-black px-6 py-2 text-[13px] uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </form>

      {error && (
        <div className="mt-6 border border-black/15 px-4 py-3 text-sm text-black">
          Something went wrong: {error}
        </div>
      )}

      {result && (
        <div className="mt-6 flex items-start gap-2 border border-black/15 px-4 py-3 text-sm text-black">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
          <div>
            <p className="font-medium">{status.label}</p>
            {result.reasoning && (
              <p className="mt-1 text-black/50">{result.reasoning}</p>
            )}
            {result.classificationError && (
              <p className="mt-1 text-black/50">
                Review check failed ({result.classificationError}) — a person
                will take a look.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}