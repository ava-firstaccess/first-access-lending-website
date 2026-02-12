'use client';

import Header from '@/components/Header';
import ProductTabs from '@/components/ProductTabs';
import CustomGoogleReviews from '@/components/CustomGoogleReviews';
import Footer from '@/components/Footer';

export default function Home() {
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
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
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
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <h2 className="font-heading text-3xl font-bold text-center text-[#003961] mb-8">
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
              <h3 className="font-heading text-2xl font-bold text-[#003961]">Instant Access</h3>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              <strong className="text-[#003961]">Get your instant rate quote</strong> in minutes. Quick, streamlined, and built for borrowers who are ready to move.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start text-gray-700">
                <svg className="w-5 h-5 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span><strong>Instant rate quote</strong> delivered immediately</span>
              </li>
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
            </ul>
            <button className="w-full bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all">
              Get Access →
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
              <h3 className="font-heading text-2xl font-bold text-[#003961]">Guided Access</h3>
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
              Get Access →
            </button>
          </div>
        </div>
      </section>

      {/* Google Reviews Widget */}
      <CustomGoogleReviews />

      {/* Product Tabs */}
      <div id="products">
        <ProductTabs />
      </div>

      {/* Product Overview - Quick Links */}
      <section className="bg-white py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <a href="/heloc" className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-6 hover:shadow-lg transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">HELOC</h3>
              <p className="text-gray-700 text-sm">Revolving line of credit. Draw what you need, when you need it.</p>
            </a>
            <a href="/second-mortgages" className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-6 hover:shadow-lg transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Second Mortgages</h3>
              <p className="text-gray-700 text-sm">Fixed-rate lump sum. Predictable payments.</p>
            </a>
            <a href="/refinance" className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-6 hover:shadow-lg transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Refinance</h3>
              <p className="text-gray-700 text-sm">Replace your mortgage and access cash.</p>
            </a>
            <a href="/home-purchase" className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-6 hover:shadow-lg transition-all">
              <h3 className="font-heading text-xl font-bold text-[#003961] mb-2">Home Purchase</h3>
              <p className="text-gray-700 text-sm">Financing for your next property.</p>
            </a>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="bg-[#FAFAFA] py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6 max-w-md mx-auto">
            <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">5.0★</div>
              <div className="text-sm text-gray-600">Client satisfaction rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-white py-10">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-heading text-4xl font-bold text-[#003961] mb-6 text-center">
            We're Second Lien Specialists
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-gray-700 mb-4">
              First Access Lending specializes in <strong className="text-[#003961]">second lien mortgages</strong>, HELOCs and closed-end seconds that unlock your home equity without refinancing your primary mortgage.
            </p>
            <p className="text-lg text-gray-700">
              Keep your great first mortgage rate. Access your equity. Your home, your decisions, your timeline.
            </p>
          </div>
        </div>
      </section>

      {/* Real Google Reviews Section */}
      <section id="reviews" className="py-10 bg-gradient-to-br from-[#FAFAFA] to-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-4xl font-bold text-[#003961] mb-4 text-center">
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
                  ,  {review.name}
                </p>
                <p className="text-xs text-gray-500">
                  {review.location}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
