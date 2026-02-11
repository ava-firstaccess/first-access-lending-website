import type { Metadata } from "next";
import { Roboto, Roboto_Condensed } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
});

const robotoCondensed = Roboto_Condensed({
  weight: ['700'],
  subsets: ['latin'],
  variable: '--font-roboto-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "First Access Lending | Second Lien Solutions",
  description: "AI-powered second lien mortgages - HELOCs and closed-end seconds. Choose AI or human-led service.",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${robotoCondensed.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
