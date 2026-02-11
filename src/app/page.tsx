'use client';
import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('heloc');

  const tabs = [
    { id: 'heloc', label: 'HELOC' },
    { id: 'second-mortgages', label: 'Second Mortgages' },
    { id: 'refinance', label: 'Refinance' },
    { id: 'purchase', label: 'Home Purchase' }
  ];

  const reviews = [
    {
      name: "Sophia A.",
      location: "San Antonio, TX",
      text: "I had a great experience buying a home thanks to an exceptional team! The process was smooth and efficient from start to finish. Zachary Bosson and the team made the mortgage process manageable and easy.",
      rating: 5
    },
    {
      name: "M.",
      location: "Alexandria, VA",
      text: "Working with Zach and his team during the home buying process made it so easy! It was great to work with a trustworthy company and representative during such a big decision.",
      rating: 5
    },
    {
      name: "David",
      location: "Alexandria, VA",
      text: "I worked with Zach Bosson when shopping for my first mortgage. He took the time to explain the ins and outs of what to look for and was incredibly patient with all of my questions. It felt great to work with someone who genuinely wanted to partner with me.",
      rating: 5
    },
    {
      name: "Ian",
      location: "Baltimore, MD",
      text: "It was very easy to apply, and I got what I was looking for right away. Fast process, and a lot of options. The loan officer was super helpful. My family got the financing we needed.",
      rating: 5
    }
  ];

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      {/* Header - Match Figure.com Ratio EXACTLY */}
      <header className="bg-[#003961] text-white sticky top-0 z-50 shadow-lg">
        <nav className="h-[46px] max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-[0.9rem] md:h-[1.125rem] xl:h-[1.37rem] w-auto"
            />
          </div>
          <div className="flex gap-6 text-sm">
            <a href="#products" className="hover:text-[#0EF0F0] transition">Products</a>
            <a href="#about" className="hover:text-[#0EF0F0] transition">About</a>
            <a href="#reviews" className="hover:text-[#0EF0F0] transition">Reviews</a>
            <a href="#contact" className="hover:text-[#0EF0F0] transition">Contact</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Your Home Has Value.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              We Give You Access.
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
            Unlock your home equity with <strong className="text-[#003961]">second liens and HELOCs</strong>. Fast, flexible financing for your next move.
          </p>
        </div>
      </section>

      {/* Dual Pathway Cards - Primary CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-3xl font-bold text-center text-[#003961] mb-8">
          Choose Your Path to Access
        </h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Instant Access Card */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#0EF0F0] hover:shadow-2xl transition-all p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-[#0EF0F0] to-[#0283DB] p-4 rounded-xl">
                <svg className="w-8 h-8 text-[#003961]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[#003961]">Instant Access</h3>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              Already know what you need? Jump straight to our application. Quick, streamlined, and built for borrowers who are ready to move.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Apply in minutes</span>
              </li>
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Self-service portal</span>
              </li>
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Fast approvals</span>
              </li>
            </ul>
            <button className="w-full bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
              Start Application →
            </button>
          </div>

          {/* Guided Access Card */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#0283DB] hover:shadow-2xl transition-all p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-[#0283DB] to-[#003961] p-4 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[#003961]">Guided Access</h3>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              Want expert guidance? Schedule a consultation with our lending team. We'll walk you through options and build a solution tailored to you.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>One-on-one consultation</span>
              </li>
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Personalized recommendations</span>
              </li>
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>White-glove support</span>
              </li>
            </ul>
            <button className="w-full bg-gradient-to-r from-[#0283DB] to-[#003961] text-white font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
              Schedule Consultation →
            </button>
          </div>
        </div>
      </section>

      {/* Tabs Navigation - Figure.com Style */}
      <section id="products" className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-[#003961] border-[#0EF0F0]'
                    : 'text-gray-600 border-transparent hover:text-[#003961] hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Content - Key Features */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          {activeTab === 'heloc' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-3xl font-bold text-[#003961] mb-6">Home Equity Line of Credit</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Keep your low first mortgage rate and access your equity with a HELOC. Draw what you need, when you need it.
                </p>
                <button className="bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
                  Get Started →
                </button>
              </div>
              <div className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-8">
                <h3 className="text-xl font-bold text-[#003961] mb-4">Key Features</h3>
                <ul className="space-y-3">
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Loans up to $850K</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Primary, vacation, and investment properties</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Up to 4 units</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>No appraisal required</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Fast approval and funding</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'second-mortgages' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-3xl font-bold text-[#003961] mb-6">Second Mortgages</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Access your equity with a fixed-rate second mortgage. One lump sum, predictable payments.
                </p>
                <button className="bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
                  Get Started →
                </button>
              </div>
              <div className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-8">
                <h3 className="text-xl font-bold text-[#003961] mb-4">Key Features</h3>
                <ul className="space-y-3">
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Loans up to $850K</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Fixed rates and terms</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Keep your existing first mortgage</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>No appraisal required</strong></span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'refinance' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-3xl font-bold text-[#003961] mb-6">Cash-Out Refinance</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Refinance your existing mortgage and take cash out. Consolidate debt or fund projects.
                </p>
                <button className="bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
                  Get Started →
                </button>
              </div>
              <div className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-8">
                <h3 className="text-xl font-bold text-[#003961] mb-4">Key Features</h3>
                <ul className="space-y-3">
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Competitive rates</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Streamlined process</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Expert guidance throughout</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'purchase' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-3xl font-bold text-[#003961] mb-6">Home Purchase</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Whether you're a first-time buyer or experienced investor, we have the right loan for you.
                </p>
                <button className="bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
                  Get Started →
                </button>
              </div>
              <div className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-8">
                <h3 className="text-xl font-bold text-[#003961] mb-4">Key Features</h3>
                <ul className="space-y-3">
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Primary, vacation, and investment properties</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Up to 4 units</strong></span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Multiple loan programs</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Personalized service</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Trust Signals */}
      <section className="bg-[#FAFAFA] py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-8 shadow-sm border border-[#0EF0F0]/30 mx-auto block w-fit">
            <div className="w-2 h-2 bg-[#0EF0F0] rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-[#003961]">Unlocking Home Equity Since 2020</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">$50M+</div>
              <div className="text-sm text-gray-600">In home equity unlocked</div>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">&lt;48hrs</div>
              <div className="text-sm text-gray-600">Average approval time</div>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">4.9★</div>
              <div className="text-sm text-gray-600">Client satisfaction rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-[#003961] mb-6 text-center">
            We're Second Lien Specialists
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-gray-700 mb-4">
              First Access Lending specializes in <strong className="text-[#003961]">second lien mortgages</strong>—HELOCs and closed-end seconds that unlock your home equity without refinancing your primary mortgage.
            </p>
            <p className="text-lg text-gray-700">
              Keep your great first mortgage rate. Access your equity. Your home, your decisions, your timeline.
            </p>
          </div>
        </div>
      </section>

      {/* Real Google Reviews Section */}
      <section id="reviews" className="py-16 bg-gradient-to-br from-[#FAFAFA] to-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-[#003961] mb-4 text-center">
            What Our Clients Say
          </h2>
          <p className="text-center text-gray-600 mb-12">Real reviews from real people</p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reviews.map((review, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 mb-4 italic text-sm">
                  "{review.text}"
                </p>
                <p className="text-sm font-semibold text-[#003961]">
                  — {review.name}
                </p>
                <p className="text-xs text-gray-500">
                  {review.location}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-[#003961] text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Unlock Your Access?</h2>
          <p className="text-xl text-[#0EF0F0] mb-8">
            Get started today or reach out directly. We're here to help.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <a 
              href="mailto:info@firstaccesslending.com"
              className="bg-white text-[#003961] px-8 py-4 rounded-xl font-bold hover:bg-[#0EF0F0] hover:scale-105 transition-all"
            >
              📧 Email Us
            </a>
            <a 
              href="tel:+1234567890"
              className="bg-[#0283DB] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#0EF0F0] hover:text-[#003961] hover:scale-105 transition-all"
            >
              📞 Call Now
            </a>
          </div>
        </div>
      </section>

      {/* Footer - NMLS Info Moved Here */}
      <footer className="bg-[#000C14] text-gray-400 py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <p className="mb-2">© 2026 First Access Lending. All rights reserved.</p>
            <p className="text-sm mb-2">
              <strong className="text-white">NMLS #1988098</strong> | Equal Housing Lender
            </p>
            <p className="text-xs max-w-3xl mx-auto">
              First Access Lending is a division of East Coast Capital Corp. Licensed by the Virginia State Corporation 
              Commission MC-6961. Loans made or arranged pursuant to Department of Financial Protection and Innovation 
              California Financing Law License.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
