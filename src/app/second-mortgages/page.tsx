'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import DualPathwayCards from '@/components/DualPathwayCards';
import CustomGoogleReviews from '@/components/CustomGoogleReviews';
import Footer from '@/components/Footer';

export default function SecondMortgagesPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section - Second Mortgages Specific, Never Changes */}
      <section className="max-w-7xl mx-auto px-6 pt-6 pb-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Second Mortgages{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              Fixed-Rate Equity Access
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
            Access your equity with a fixed-rate second mortgage. One lump sum, predictable payments.
          </p>
        </div>
      </section>

      {/* Dual Pathway Cards */}
      <DualPathwayCards />

      {/* Google Reviews Widget */}
      <CustomGoogleReviews />

      {/* Product Tabs - Fixed Order, Content Changes on Click */}
      <ProductTabs currentProduct="second-mortgages" />

      {/* Second Lien Specialists Message */}
      <section className="bg-white py-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-heading text-3xl font-bold text-[#003961] mb-4">
            We're Second Lien Specialists
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            Protect your low first mortgage rate. A second mortgage gives you a lump sum of cash without refinancing your existing loan. One predictable payment, no disruption to your current rate.
          </p>
        </div>
      </section>

      {/* Common Uses */}
      <section className="bg-[#FAFAFA] pt-6 pb-6">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-heading text-3xl font-bold text-[#003961] mb-8 text-center">Common Uses for a Second Lien</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Real Estate Investments</h3>
              <p className="text-gray-700">Fund down payments or purchase investment properties outright</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Business Capital</h3>
              <p className="text-gray-700">Lump sum funding for business expansion or startup costs</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Portfolio Expansion</h3>
              <p className="text-gray-700">Capital to grow your real estate holdings or diversify investments</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Major Renovations</h3>
              <p className="text-gray-700">Complete large projects with one lump sum</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Debt Consolidation</h3>
              <p className="text-gray-700">Pay off high-interest credit cards or loans with fixed payments</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Education Funding</h3>
              <p className="text-gray-700">Finance tuition or educational expenses with a single disbursement</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
