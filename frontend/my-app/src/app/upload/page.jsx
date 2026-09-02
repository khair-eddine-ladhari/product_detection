"use client";

import { useState } from "react";
import { createProduct } from "@/app/lib/api";

const initialForm = { name: "", description: "", imageUrl: "", price: "" };

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

export default function UploadPage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const created = await createProduct({
        ...form,
        price: Number(form.price) || 0,
      });
      setResult(created);
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const status = result && (statusCopy[result.status] || statusCopy.pending);

  return (
    <div className="max-w-prose">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Sell an item</h1>
        <p className="mt-2 text-sm text-ink/70">
          Every listing runs through automatic review before it appears in the
          store. Most clear in a few seconds.
        </p>
      </div>

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
          <label className="block text-sm font-medium" htmlFor="imageUrl">
            Image URL
          </label>
          <input
            id="imageUrl"
            required
            type="url"
            value={form.imageUrl}
            onChange={update("imageUrl")}
            className="mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none"
            placeholder="https://…"
          />
          <p className="mt-1 text-xs text-ink/50">
            Use a direct image link (no redirects) — some hosts break
            automatic review.
          </p>
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
          {submitting ? "Checking listing…" : "Submit listing"}
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