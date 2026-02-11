'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import Footer from '@/components/Footer';

export default function HelocPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Home Equity Line of Credit{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              (HELOC)
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
            Keep your low first mortgage rate and access your equity with a HELOC. Draw what you need, when you need it.
          </p>
        </div>
      </section>

      <ProductTabs currentProduct="heloc" />

      {/* Product Details */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-[#003961] mb-6">Flexible Access to Your Equity</h2>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                A HELOC gives you a revolving line of credit secured by your home equity. Unlike a traditional loan, 
                you can borrow, repay, and borrow again during the draw period—perfect for ongoing projects, 
                emergencies, or opportunities.
              </p>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                Keep your existing low-rate first mortgage untouched while accessing the equity you've built.
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
                    <strong className="text-[#003961]">Loans up to $850K</strong>
                    <p className="text-sm text-gray-600 mt-1">Access substantial equity for major projects</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Primary, vacation, and investment properties</strong>
                    <p className="text-sm text-gray-600 mt-1">Flexible property eligibility</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Up to 4 units</strong>
                    <p className="text-sm text-gray-600 mt-1">Multi-unit properties eligible</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">No appraisal required</strong>
                    <p className="text-sm text-gray-600 mt-1">Streamlined approval process</p>
                  </div>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">Fast approval and funding</strong>
                    <p className="text-sm text-gray-600 mt-1">Get your funds quickly</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Common Uses */}
      <section className="bg-[#FAFAFA] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#003961] mb-8 text-center">Common Uses for a HELOC</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">🏗️</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Home Renovations</h3>
              <p className="text-gray-700">Fund remodels, additions, or upgrades over time</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">💳</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Debt Consolidation</h3>
              <p className="text-gray-700">Pay off high-interest credit cards or loans</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="text-3xl mb-3">🎓</div>
              <h3 className="text-xl font-bold text-[#003961] mb-2">Education Expenses</h3>
              <p className="text-gray-700">Finance tuition or educational costs</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
