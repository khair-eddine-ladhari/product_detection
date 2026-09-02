import Link from "next/link";
import { getProducts } from "@/app/lib/api";

export default async function StorePage() {
  let products = [];
  let loadError = null;

  try {
    products = await getProducts("published");
  } catch (err) {
    loadError = err.message;
  }

  return (
    <div>
      <div className="mb-8 max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight">
          What's for sale
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Every listing here has already passed automatic review. Nothing
          gets on this page without a check first.
        </p>
      </div>

      {loadError && (
        <div className="rounded border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          Couldn't load the store right now ({loadError}). Check that the
          backend is running.
        </div>
      )}

      {!loadError && products.length === 0 && (
        <div className="rounded border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-ink/60">
            Nothing's live yet. Once a listing clears review, it'll show up
            here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {products.map((p) => (
          <article
            key={p._id}
            className="overflow-hidden rounded border border-line bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-44 w-full object-cover"
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{p.name}</h2>
                <span className="whitespace-nowrap text-sm font-medium text-moss">
                  ${p.price}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink/60">
                {p.description}
              </p>
              <Link
                href={`/edit/${p._id}`}
                className="mt-3 inline-block rounded border border-line px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-line/20"
              >
                Edit
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}