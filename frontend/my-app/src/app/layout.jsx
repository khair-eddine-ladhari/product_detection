import "./globals.css";

export const metadata = {
  title: "The Yard — Store",
  description: "List it, we check it, it goes live.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        <header className="border-b border-black/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
            <a href="/" className="text-[13px] font-medium uppercase tracking-[0.25em] text-black">
              The Yard
            </a>
            <nav className="flex gap-7 text-[12px] uppercase tracking-[0.1em] text-black/60">
              <a href="/" className="transition-colors hover:text-black">
                Store
              </a>
              <a href="/upload" className="transition-colors hover:text-black">
                Sell an item
              </a>
              <a href="/review" className="transition-colors hover:text-black">
                Review queue
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10">{children}</main>
      </body>
    </html>
  );
}