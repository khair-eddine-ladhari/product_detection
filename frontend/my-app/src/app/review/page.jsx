"use client";

import { useEffect, useState } from "react";
import { getProducts, updateProductStatus } from "@/app/lib/api";

export default function ReviewPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actingOn, setActingOn] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts("review");
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id, status) {
    setActingOn(id);
    try {
      await updateProductStatus(id, status);
      setItems((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div>
      <div className="mb-8 max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight">
          Review queue
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Listings automatic review couldn't clear on its own. Approve to put
          them in the store, or reject to keep them out.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-ink/60">Loading queue…</p>}

      {!loading && items.length === 0 && !error && (
        <div className="rounded border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-ink/60">Queue's empty. Nice.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((p) => (
          <article
            key={p._id}
            className="flex flex-col gap-4 rounded border border-line bg-white p-4 sm:flex-row"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-32 w-full rounded object-cover sm:w-40"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{p.name}</h2>
                <span className="whitespace-nowrap text-sm font-medium text-moss">
                  ${p.price}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/60">{p.description}</p>
              {p.reasoning && (
                <p className="mt-2 rounded border border-amber/30 bg-amber/5 px-3 py-2 text-xs text-amber">
                  {p.reasoning}
                </p>
              )}
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => decide(p._id, "published")}
                  disabled={actingOn === p._id}
                  className="rounded bg-mossDeep px-4 py-1.5 text-sm font-medium text-paper hover:bg-moss disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(p._id, "rejected")}
                  disabled={actingOn === p._id}
                  className="rounded border border-clay/40 px-4 py-1.5 text-sm font-medium text-clay hover:bg-clay/5 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}