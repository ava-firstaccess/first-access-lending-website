'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import DualPathwayCards from '@/components/DualPathwayCards';
import Footer from '@/components/Footer';

export default function HomePurchasePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section - Home Purchase Specific, Never Changes */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Home Purchase{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              Your Next Property Starts Here
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
            Whether you're a first-time buyer or experienced investor, we have the right loan for you.
          </p>
        </div>
      </section>

      {/* Dual Pathway Cards */}
      <DualPathwayCards />

      {/* Product Tabs - Fixed Order, Content Changes on Click */}
      <ProductTabs currentProduct="home-purchase" />

      {/* Loan Programs */}
      <section className="bg-[#FAFAFA] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#003961] mb-8 text-center">Available Loan Programs</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">🏠</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Conventional</h3>
              <p className="text-gray-700">Standard loans with competitive rates and terms</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">🎖️</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">FHA & VA</h3>
              <p className="text-gray-700">Government-backed loans for qualified buyers</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">💎</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Jumbo</h3>
              <p className="text-gray-700">High-balance loans for luxury properties</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
