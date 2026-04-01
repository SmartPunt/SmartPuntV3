import "./globals.css";

export const metadata = {
  title: "Fortune on 5",
  description: "Premium horse racing tips",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <header className="border-b border-amber-300/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Fortune on 5"
                className="h-14 w-auto"
              />
            </div>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
