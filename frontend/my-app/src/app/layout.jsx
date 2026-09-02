import "./globals.css";

export const metadata = {
  title: "The Yard — Store",
  description: "List it, we check it, it goes live.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <a href="/" className="text-lg font-semibold tracking-tight">
              The Yard
            </a>
            <nav className="flex gap-6 text-sm">
              <a href="/" className="hover:text-moss">
                Store
              </a>
              <a href="/upload" className="hover:text-moss">
                Sell an item
              </a>
              <a href="/review" className="hover:text-moss">
                Review queue
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}