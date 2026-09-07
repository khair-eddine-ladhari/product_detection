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
    <div className="bg-white min-h-screen">
      {/* Masthead — thin, wide-set, plenty of air. No color, just type and space. */}
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 sm:px-10">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.2em] text-black">
          Store
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-black/50">
          Every listing here cleared review before it reached this page.
        </p>
      </div>

      <div className="mx-auto max-w-6xl border-t border-black/10" />

      {loadError && (
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <p className="text-sm font-medium text-black">Store didn&rsquo;t load</p>
          <p className="mt-1 text-sm text-black/50">
            {loadError} &mdash; confirm the backend is running and try again.
          </p>
        </div>
      )}

      {!loadError && products.length === 0 && (
        <div className="mx-auto max-w-6xl px-6 py-24 text-center sm:px-10">
          <p className="text-sm font-medium text-black">Nothing&rsquo;s live yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-black/50">
            The moment a listing clears review, it lands here.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <div className="grid grid-cols-2 gap-x-5 gap-y-14 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <article key={p._id} className="group">
              <div className="relative aspect-[3/4] overflow-hidden bg-black/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                />
              </div>

              <div className="mt-3 flex items-start justify-between gap-2">
                <h2 className="text-[13px] leading-snug text-black">
                  {p.name}
                </h2>
                <span className="whitespace-nowrap text-[13px] text-black">
                  ${p.price}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-black/70" />
                <span className="text-[11px] text-black/40">Reviewed</span>
              </div>

              <Link
                href={`/edit/${p._id}`}
                className="mt-2 inline-block text-[11px] text-black/40 underline underline-offset-4 transition-colors hover:text-black"
              >
                Edit listing
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}