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
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}
