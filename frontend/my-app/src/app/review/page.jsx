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
    <div className="bg-white">
      <div className="mb-10 max-w-prose">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.2em] text-black">
          Review queue
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-black/50">
          Listings automatic review couldn&rsquo;t clear on its own. Approve
          to put them in the store, or reject to keep them out.
        </p>
      </div>

      {error && (
        <div className="mb-6 border border-black/15 px-4 py-3 text-sm text-black">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-black/50">Loading queue…</p>}

      {!loading && items.length === 0 && !error && (
        <div className="border border-black/10 px-6 py-16 text-center">
          <p className="text-sm text-black/50">Queue&rsquo;s empty. Nice.</p>
        </div>
      )}

      <div className="space-y-px bg-black/10">
        {items.map((p) => (
          <article
            key={p._id}
            className="flex flex-col gap-5 bg-white p-5 sm:flex-row"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-40 w-full object-cover sm:h-36 sm:w-32"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[13px] font-medium text-black">{p.name}</h2>
                <span className="whitespace-nowrap text-[13px] text-black">
                  ${p.price}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-black/50">
                {p.description}
              </p>
              {p.reasoning && (
                <p className="mt-3 border-l-2 border-black/20 pl-3 text-xs leading-relaxed text-black/50">
                  {p.reasoning}
                </p>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => decide(p._id, "published")}
                  disabled={actingOn === p._id}
                  className="border border-black bg-black px-4 py-1.5 text-[12px] uppercase tracking-[0.08em] text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(p._id, "rejected")}
                  disabled={actingOn === p._id}
                  className="border border-black/30 px-4 py-1.5 text-[12px] uppercase tracking-[0.08em] text-black transition-colors hover:border-black disabled:opacity-40"
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