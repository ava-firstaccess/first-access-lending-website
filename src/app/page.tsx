import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FAFAFA] to-gray-100">
      {/* Header - Bigger Logo, No Tagline */}
      <header className="bg-[#003961] text-white py-6 px-8 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-20 w-auto"
            />
          </div>
          <nav className="flex gap-6">
            <a href="#about" className="hover:text-[#0EF0F0] transition">About</a>
            <a href="#reviews" className="hover:text-[#0EF0F0] transition">Reviews</a>
            <a href="#contact" className="hover:text-[#0EF0F0] transition">Contact</a>
          </nav>
        </div>
      </header>

      {/* HERO CTA Section - Front and Center */}
      <section className="max-w-7xl mx-auto px-8 py-12">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Your Home Has Value.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              We Give You Access.
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-6 max-w-3xl mx-auto">
            Whether you need funds for home improvements, debt consolidation, or life's next big move—we help homeowners 
            tap into their equity with <strong className="text-[#003961]">second liens and HELOCs</strong>. Fast, flexible, and built for you.
          </p>

          <p className="text-lg text-[#0283DB] font-semibold mb-8">
            Choose your path ↓
          </p>
        </div>

        {/* Dual Pathway Cards - THE HERO */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
          {/* Instant Access Card */}
          <div className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border-4 border-[#0283DB] hover:border-[#0EF0F0]">
            <div className="absolute top-0 right-0 bg-[#0EF0F0] text-[#003961] px-4 py-2 rounded-bl-xl font-bold text-sm">
              INSTANT
            </div>
            <div className="p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0EF0F0] to-[#0283DB] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-[#003961] mb-4">Instant Access</h3>
              <p className="text-gray-700 mb-6 leading-relaxed text-lg">
                <strong className="text-[#003961]">Fast. Digital. Straightforward.</strong> Our platform evaluates your equity instantly and delivers a personalized quote in seconds. No phone calls, no waiting rooms—just access.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Instant rate quote—know your options now</span>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>100% digital—apply from your couch</span>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Available 24/7—midnight or midday, we're ready</span>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Completely confidential—your business, your privacy</span>
                </li>
              </ul>
              <button className="w-full bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold py-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-lg">
                Get Instant Access →
              </button>
            </div>
          </div>

          {/* Guided Access Card */}
          <div className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border-4 border-[#003961] hover:border-[#0283DB]">
            <div className="absolute top-0 right-0 bg-[#003961] text-[#0EF0F0] px-4 py-2 rounded-bl-xl font-bold text-sm">
              GUIDED
            </div>
            <div className="p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#003961] to-[#0283DB] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-[#003961] mb-4">Guided Access</h3>
              <p className="text-gray-700 mb-6 leading-relaxed text-lg">
                <strong className="text-[#003961]">Personal. Expert. Human.</strong> Talk with a real loan officer who lives and breathes second liens. Complex situation? Unique property? We've seen it—and we'll navigate it together.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>One-on-one consultation with a dedicated expert</span>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Custom solutions for unique scenarios</span>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Answers to every question—no rush, no judgment</span>
                </li>
                <li className="flex items-start text-gray-700">
                  <svg className="w-6 h-6 text-[#0283DB] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Relationship-focused—you're not just a number</span>
                </li>
              </ul>
              <button className="w-full bg-gradient-to-r from-[#003961] to-[#0283DB] text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-lg">
                Talk to an Expert →
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mb-12">
          <p className="text-[#0283DB] font-semibold text-lg">
            Both paths lead to the same great rates. Choose what feels right—you can always switch.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            🔒 Secure application • No impact to credit score • NMLS #1988098
          </p>
        </div>

        {/* Trust Signals - Moved Below CTA */}
        <div className="max-w-5xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full mb-8 shadow-sm border border-[#0EF0F0]/30 mx-auto block w-fit">
            <div className="w-2 h-2 bg-[#0EF0F0] rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-[#003961]">Unlocking Home Equity Since 2020</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">$50M+</div>
              <div className="text-sm text-gray-600">In home equity unlocked</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">&lt;48hrs</div>
              <div className="text-sm text-gray-600">Average approval time</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="text-4xl font-bold text-[#003961] mb-2">4.9★</div>
              <div className="text-sm text-gray-600">Client satisfaction rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section - More Soulful */}
      <section id="about" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-[#003961] mb-8 text-center">
            We're Second Lien Specialists
          </h2>
          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
            <p className="text-xl mb-6 text-center text-gray-600">
              Not all lending is created equal. We focus on what we do best.
            </p>
            <div className="bg-gradient-to-br from-[#FAFAFA] to-white border-l-4 border-[#0EF0F0] p-8 rounded-lg shadow-sm mb-6">
              <p className="text-lg mb-4">
                First Access Lending specializes in <strong className="text-[#003961]">second lien mortgages</strong>—HELOCs and closed-end seconds that unlock your home equity <em>without</em> refinancing your primary mortgage. Keep your great first mortgage rate. Access your equity. Win-win.
              </p>
              <p className="text-lg mb-4">
                Your home isn't just shelter—it's a financial tool. We help you put it to work for renovations, debt consolidation, 
                investment opportunities, education, or whatever matters most to you. Your equity, your decisions, your timeline.
              </p>
            </div>
            <p className="text-2xl text-center text-[#003961] font-bold mt-8">
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
          <p className="text-center text-gray-600 mb-12">Real reviews from real people</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
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
          <h2 className="text-4xl font-bold mb-6">Ready to Unlock Your Access?</h2>
          <p className="text-xl text-[#0EF0F0] mb-8">
            Choose your path above, or reach out directly. We're here to help.
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

      {/* Footer */}
      <footer className="bg-[#000C14] text-gray-400 py-8 px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="mb-2">© 2026 First Access Lending. All rights reserved.</p>
          <p className="text-sm">NMLS #1988098 | Equal Housing Lender</p>
        </div>
      </footer>
    </main>
  );
}
