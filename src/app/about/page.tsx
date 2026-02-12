'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-6">
            Get Your Rate.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              Instantly.
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            And when your scenario needs more - we're built for that too.
          </p>
        </div>
      </section>

      {/* Who We Serve Section */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-[#003961] mb-12">
          Who We Serve
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Checkmark List Items */}
          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                W-2 income, straightforward scenario → <strong className="text-[#003961]">Instant rate quote</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                Self-employed, bank statements → <strong className="text-[#003961]">Custom review</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                Multiple properties, portfolio strategy → <strong className="text-[#003961]">Specialist guidance</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                Credit 620+, second lien focus → <strong className="text-[#003961]">We specialize in second liens</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                Complex income, turned down elsewhere → <strong className="text-[#003961]">Real people, real review</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                Property value shorted → <strong className="text-[#003961]">Full-picture assessment</strong>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4 hover:shadow-lg transition-all">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 leading-relaxed">
                Small loan others won't touch → <strong className="text-[#003961]">We're built for it</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section className="bg-gradient-to-br from-[#003961] to-[#0283DB] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-white mb-12">
            Our Mission
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
                <p className="text-white text-lg leading-relaxed">
                  <strong>Access for everyone:</strong> straightforward W-2 AND the denied
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-white text-lg leading-relaxed">
                  <strong>Second lien specialists</strong> who say yes where others say no
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-white text-lg leading-relaxed">
                  <strong>The simple AND the complex,</strong> everyone in between
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-[#0EF0F0]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-white text-lg leading-relaxed">
                  <strong>No runaround,</strong> just answers
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-[#003961] mb-12">
          Leadership
        </h2>
        
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            {/* Photo Placeholder */}
            <div className="flex-shrink-0">
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#0283DB] to-[#0EF0F0] flex items-center justify-center">
                <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2 italic">
                Photo coming soon
              </p>
            </div>
            
            {/* Bio Content */}
            <div className="flex-1">
              <h3 className="font-heading text-2xl md:text-3xl font-bold text-[#003961] mb-2">
                Zachary Bosson
              </h3>
              <p className="text-[#0283DB] font-semibold mb-4">
                Founder & CEO
              </p>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Zach founded First Access Lending with a mission to democratize access to homeownership and wealth-building through home equity. With years of experience in the mortgage industry, he saw firsthand how traditional lenders often turned away borrowers who didn't fit a narrow mold.
                </p>
                <p>
                  Today, First Access Lending specializes in second liens and complex scenarios that other lenders reject. Whether you have W-2 income looking for an instant quote or you're self-employed with a unique situation, Zach and his team have built a lending platform that serves everyone.
                </p>
                <p>
                  Zach believes homeownership is the foundation of building wealth in America, and he's dedicated to extending that access beyond the already wealthy through specialized products, personalized consultation, and unwavering integrity.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500 italic">
            Note: Bio and photo fetched from existing site. Manual review recommended for accuracy and current headshot.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#FAFAFA] py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-[#003961] mb-6">
            Ready to Get Access?
          </h2>
          <p className="text-xl text-gray-700 mb-8 leading-relaxed">
            Whether you need an instant rate quote or want to talk through your options, we're here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/heloc"
              className="bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all"
            >
              Get Instant Quote →
            </a>
            <a 
              href="/#contact"
              className="bg-gradient-to-r from-[#0283DB] to-[#003961] text-white font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all"
            >
              Schedule Consultation →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
