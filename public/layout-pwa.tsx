import "./globals.css";

export const metadata = {
  title: "SmartPunt",
  description: "SmartPunt - Premium Horse Racing Intelligence",
  applicationName: "SmartPunt",
  manifest: "/manifest.json",
  themeColor: "#050505",
  appleWebApp: {
    capable: true,
    title: "SmartPunt",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/smartpunt-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/smartpunt-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
