import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FAFAFA] to-gray-100">
      {/* Header */}
      <header className="bg-[#003961] text-white py-6 px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-16 w-auto"
            />
            <div className="border-l border-[#0EF0F0] pl-4">
              <p className="text-[#0EF0F0] text-lg font-semibold">Second Lien Solutions</p>
            </div>
          </div>
          <nav className="flex gap-6">
            <a href="#about" className="hover:text-[#0EF0F0] transition">About</a>
            <a href="#reviews" className="hover:text-[#0EF0F0] transition">Reviews</a>
            <a href="#contact" className="hover:text-[#0EF0F0] transition">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero: Dual Pathway Choice */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-[#003961] mb-4">
            Unlock Your Home's Equity
          </h2>
          <p className="text-xl text-gray-700 mb-2">
            Two paths. One destination. Total access.
          </p>
          <p className="text-lg text-[#0283DB] font-semibold">
            Choose how you want to access your funds
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* AI Pathway */}
          <div className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border-4 border-[#0283DB] hover:border-[#0EF0F0]">
            <div className="absolute top-0 right-0 bg-[#0EF0F0] text-[#003961] px-4 py-2 rounded-bl-xl font-bold text-sm">
              INSTANT
            </div>
            <div className="p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0EF0F0] to-[#0283DB] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  <circle cx="17" cy="9" r="1" fill="currentColor" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-[#003961] mb-4">Instant Access</h3>
              <p className="text-gray-700 mb-6 leading-relaxed">
                <strong className="text-[#003961]">Direct. Digital. Done.</strong> Our platform analyzes your home equity and credit profile instantly, delivering a personalized quote in seconds—no calls, no waiting, just access.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0EF0F0] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Instant rate quote
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0EF0F0] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  No human interaction required
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0EF0F0] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  24/7 availability
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0EF0F0] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Completely confidential
                </li>
              </ul>
              <button className="w-full bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold py-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                Get Instant Access →
              </button>
            </div>
          </div>

          {/* Human Pathway */}
          <div className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border-4 border-[#003961] hover:border-[#0283DB]">
            <div className="absolute top-0 right-0 bg-[#003961] text-[#0EF0F0] px-4 py-2 rounded-bl-xl font-bold text-sm">
              GUIDED
            </div>
            <div className="p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#003961] to-[#0283DB] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-[#003961] mb-4">Guided Access</h3>
              <p className="text-gray-700 mb-6 leading-relaxed">
                <strong className="text-[#003961]">Personal. Expert. Proven.</strong> Work one-on-one with an experienced loan officer who knows second liens inside out. Complex scenarios, unique situations—we navigate it together.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0283DB] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Personal consultation
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0283DB] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Expert guidance
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0283DB] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Complex scenarios welcome
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-[#0283DB] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Relationship-focused
                </li>
              </ul>
              <button className="w-full bg-gradient-to-r from-[#003961] to-[#0283DB] text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                Talk to an Expert →
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-[#0283DB] font-semibold text-lg">
            Both paths lead to the same great rates. Choose what feels right—you can always switch.
          </p>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-[#003961] mb-8 text-center">
            Second Lien Specialists
          </h2>
          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
            <p className="mb-4">
              First Access Lending specializes in <strong className="text-[#003961]">second lien mortgages</strong>—HELOCs and closed-end second mortgages that unlock the equity in your home without refinancing your first mortgage.
            </p>
            <p className="mb-4">
              Your home has value. We give you <strong className="text-[#0283DB]">access</strong> to it. Whether you need funds for home improvements, debt consolidation, or other financial goals, we offer flexible solutions on your terms.
            </p>
            <p className="text-xl text-[#003961] font-bold">
              Your equity. Your access. Your way.
            </p>
          </div>
        </div>
      </section>

      {/* Google Reviews Section */}
      <section id="reviews" className="py-20 bg-gradient-to-br from-[#FAFAFA] to-gray-100">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-[#003961] mb-4 text-center">
            What Our Clients Say
          </h2>
          <p className="text-center text-gray-600 mb-12">Real reviews from Google</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Review placeholders - will fetch real Google reviews */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "Loading Google reviews..."
                </p>
                <p className="text-sm text-gray-500">
                  — Google Reviewer
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <a 
              href="https://www.google.com/search?q=first+access+lending+reviews" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[#0283DB] hover:text-[#0EF0F0] font-semibold transition"
            >
              View all reviews on Google →
            </a>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-[#003961] text-white py-20">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-[#0EF0F0] mb-8">
            Choose your path above, or reach out directly.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <a 
              href="mailto:info@firstaccesslending.com"
              className="bg-white text-[#003961] px-8 py-4 rounded-xl font-bold hover:bg-[#0EF0F0] transition"
            >
              Email Us
            </a>
            <a 
              href="tel:+1234567890"
              className="bg-[#0283DB] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#0EF0F0] transition"
            >
              Call Now
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#000C14] text-gray-400 py-8 px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="mb-2">© 2026 First Access Lending. All rights reserved.</p>
          <p className="text-sm">NMLS #XXXXXX | Equal Housing Lender</p>
        </div>
      </footer>
    </main>
  );
}
