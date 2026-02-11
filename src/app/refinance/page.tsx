'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import Footer from '@/components/Footer';

export default function RefinancePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
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

      <ProductTabs currentProduct="refinance" />

      {/* Product Details */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-[#003961] mb-6">Replace & Access</h2>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                A cash-out refinance replaces your current mortgage with a new, larger loan and gives you the 
                difference in cash. This can make sense if current rates are favorable or you want to consolidate 
                multiple debts into one payment.
              </p>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                Whether you're looking to lower your rate, change your term, or access equity—we'll help you 
                find the right solution.
              </p>
              <button className="bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
                Get Started →
              </button>
            </div>

            <div className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-[#003961] mb-6">Key Features</h3>
              <ul className="space-y-4">
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Competitive rates</strong>
                    <p className="text-sm text-gray-600 mt-1">Access today's best mortgage rates</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Streamlined process</strong>
                    <p className="text-sm text-gray-600 mt-1">Efficient from application to closing</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Expert guidance throughout</strong>
                    <p className="text-sm text-gray-600 mt-1">Personalized support every step</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Multiple loan options</strong>
                    <p className="text-sm text-gray-600 mt-1">Conventional, FHA, VA, and more</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Cash out for any purpose</strong>
                    <p className="text-sm text-gray-600 mt-1">Use your equity however you need</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* When to Refinance */}
      <section className="bg-[#FAFAFA] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#003961] mb-8 text-center">When to Consider a Cash-Out Refinance</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">📉</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Rates Have Dropped</h3>
              <p className="text-gray-700">Lower your rate and access cash simultaneously</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">🔗</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Consolidate Debt</h3>
              <p className="text-gray-700">Combine high-interest debts into one lower payment</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">🛠️</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Fund Major Projects</h3>
              <p className="text-gray-700">Renovations, education, or other large expenses</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
