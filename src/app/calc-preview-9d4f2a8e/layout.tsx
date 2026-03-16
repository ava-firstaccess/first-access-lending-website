import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mortgage Payment Calculator | First Access Lending',
  description: 'Calculate your monthly mortgage payment and see potential tax savings. Free mortgage calculator with conventional and FHA loan options.',
  keywords: 'mortgage calculator, home loan calculator, mortgage payment calculator, tax savings calculator, PMI calculator, HELOC calculator, home equity calculator, First Access Lending',
  themeColor: '#FFFFFF',
  openGraph: {
    title: 'Mortgage Payment Calculator',
    siteName: 'First Access Lending',
    description: 'Calculate your monthly mortgage payment and potential tax savings.',
    type: 'website',
    url: 'https://first-access-lending-website.vercel.app/calc-preview-9d4f2a8e',
    images: [
      {
        url: '/logos/fal-logo.svg',
        width: 800,
        height: 600,
        alt: 'First Access Lending Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mortgage Payment Calculator',
    description: 'Calculate your monthly mortgage payment and potential tax savings.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
