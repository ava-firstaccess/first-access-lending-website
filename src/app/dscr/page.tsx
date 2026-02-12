'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import CustomGoogleReviews from '@/components/CustomGoogleReviews';
import Footer from '@/components/Footer';

export default function DSCRPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-6 pb-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Qualify on{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              Cash Flow, Not Income
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
            DSCR loans let <strong className="text-[#003961]">real estate investors</strong> scale their portfolio based on property performance, not personal tax returns.
          </p>

          <a 
            href="#products" 
            className="inline-block bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-10 py-5 rounded-xl hover:shadow-xl transition-all text-lg"
          >
            Get Access →
          </a>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="bg-white py-10">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-heading text-3xl font-bold text-[#003961] mb-8 text-center">
            Why Investors Choose DSCR
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-br from-[#0EF0F0] to-[#0283DB] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#003961]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-3">No Income Docs</h3>
              <p className="text-gray-700">Qualify based on rental income, not tax returns or W2s</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-[#0EF0F0] to-[#0283DB] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#003961]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-3">Scale Faster</h3>
              <p className="text-gray-700">Buy multiple properties without DTI limits</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-[#0EF0F0] to-[#0283DB] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#003961]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-3">Flexible Options</h3>
              <p className="text-gray-700">1st and 2nd lien structures available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Google Reviews Widget */}
      <CustomGoogleReviews />

      {/* Product Tabs */}
      <div id="products">
        <ProductTabs currentProduct="dscr" />
      </div>

      {/* About Section */}
      <section className="bg-white py-10">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-heading text-4xl font-bold text-[#003961] mb-6 text-center">
            Built for Real Estate Investors
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-gray-700 mb-4">
              DSCR loans are designed for <strong className="text-[#003961]">investors who want to grow</strong> their portfolio without the constraints of traditional income verification. Qualify based on the property's cash flow, not your personal tax returns.
            </p>
            <p className="text-lg text-gray-700">
              Whether you're buying your first rental or your tenth, DSCR financing lets you scale at your own pace with flexible underwriting and fast closings.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
