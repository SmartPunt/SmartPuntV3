import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cob's Rules Live Trial",
  description: "Private admin and subscriber trial."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
