import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Access Lending | Second Lien Solutions",
  description: "AI-powered second lien mortgages - HELOCs and closed-end seconds. Choose AI or human-led service.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
