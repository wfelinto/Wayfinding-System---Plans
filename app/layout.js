import "./globals.css";

export const metadata = {
  title: "Wayfinding Scoping Tool",
  description: "Plan wayfinding routes, tag messages, and scope signage from a KOP.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-black/10 bg-white">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <a href="/" className="font-semibold text-lg tracking-tight text-ink">
                Wayfinding Scoping Tool
              </a>
              <nav className="flex gap-6 text-sm text-ink/70">
                <a href="/" className="hover:text-ink">Plans</a>
                <a href="/kop" className="hover:text-ink">Sign types (KOP)</a>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
