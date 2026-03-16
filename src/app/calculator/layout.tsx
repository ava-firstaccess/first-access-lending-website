import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mortgage Payment Calculator with Tax Savings | First Access Lending',
  description: 'Calculate your monthly mortgage payment and see potential tax savings. Includes state income tax deductions, SALT cap, and PMI calculations. Free mortgage calculator with detailed breakdown.',
  keywords: 'mortgage calculator, home loan calculator, mortgage payment calculator, tax savings calculator, PMI calculator, HELOC calculator, home equity calculator, First Access Lending',
  openGraph: {
    title: 'Mortgage Payment Calculator with Tax Savings',
    description: 'Calculate your monthly mortgage payment and see potential tax savings. Free tool from First Access Lending.',
    type: 'website',
    url: 'https://firstaccesslending.com/calculator',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
