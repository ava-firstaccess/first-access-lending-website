'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import DualPathwayCards from '@/components/DualPathwayCards';
import CustomGoogleReviews from '@/components/CustomGoogleReviews';
import Footer from '@/components/Footer';

export default function RefinancePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section - Refinance Specific, Never Changes */}
      <section className="max-w-7xl mx-auto px-6 pt-6 pb-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Cash-Out Refinance{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              Lower Rate + Cash Out
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
            Refinance your existing mortgage and take cash out. Consolidate debt or fund projects.
          </p>
        </div>
      </section>

      {/* Dual Pathway Cards */}
      <DualPathwayCards />

      {/* Google Reviews Widget */}
      <CustomGoogleReviews />

      {/* Product Tabs - Fixed Order, Content Changes on Click */}
      <ProductTabs currentProduct="refinance" />

      {/* When to Refinance */}
      <section className="bg-[#FAFAFA] pt-6 pb-6">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-heading text-3xl font-bold text-[#003961] mb-8 text-center">When to Consider a Cash-Out Refinance</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Rates Have Dropped</h3>
              <p className="text-gray-700">Lower your rate and access cash simultaneously</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Consolidate Debt</h3>
              <p className="text-gray-700">Combine high-interest debts into one lower payment</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Fund Major Projects</h3>
              <p className="text-gray-700">Renovations, education, or other large expenses</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
