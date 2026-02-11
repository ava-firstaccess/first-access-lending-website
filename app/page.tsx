export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg"></div>
              <span className="text-xl font-semibold text-gray-900">First Access</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#solutions" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Solutions</a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
              <a href="#about" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">About</a>
              <a href="#get-started" className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full mb-6">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-900">AI-Powered Lending Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight mb-6">
              Unlock your home equity with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                AI-powered precision
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed mb-10 max-w-2xl">
              Second liens and HELOCs reimagined. Our intelligent platform delivers faster approvals, better rates, and a seamless experience from application to funding.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#get-started" className="px-8 py-4 bg-gray-900 text-white text-base font-medium rounded-full hover:bg-gray-800 transition-all hover:scale-105 text-center">
                Check Your Rate
              </a>
              <a href="#how-it-works" className="px-8 py-4 bg-white text-gray-900 text-base font-medium rounded-full border-2 border-gray-200 hover:border-gray-300 transition-all text-center">
                See How It Works
              </a>
            </div>
            
            <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure application · No impact to credit score · NMLS #1988098</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">$500M+</div>
              <div className="text-sm text-gray-600">In home equity unlocked</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">&lt;48hrs</div>
              <div className="text-sm text-gray-600">Average approval time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">4.9★</div>
              <div className="text-sm text-gray-600">Client satisfaction rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section id="solutions" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Smart lending solutions for modern homeowners
            </h2>
            <p className="text-xl text-gray-600">
              Access the equity in your home for whatever you need—renovation, debt consolidation, investment opportunities, or major life events.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Home Equity Lines of Credit</h3>
              <p className="text-gray-600 mb-6">
                Flexible access to your home's equity with competitive rates and smart repayment options powered by AI-driven risk analysis.
              </p>
              <a href="#" className="text-blue-600 font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">
                Learn more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Second Lien Mortgages</h3>
              <p className="text-gray-600 mb-6">
                Unlock a lump sum with fixed rates and predictable payments. Perfect for major expenses or consolidating high-interest debt.
              </p>
              <a href="#" className="text-cyan-600 font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">
                Learn more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              From application to funding in days, not weeks
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our AI-powered platform streamlines every step of the process.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="bg-white p-8 rounded-2xl">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center text-xl font-bold mb-6">
                  1
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Apply in minutes</h3>
                <p className="text-gray-600">
                  Complete our streamlined application online. Our AI instantly analyzes your scenario and provides preliminary options.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="bg-white p-8 rounded-2xl">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center text-xl font-bold mb-6">
                  2
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Get approved fast</h3>
                <p className="text-gray-600">
                  Our intelligent underwriting platform accelerates approvals while maintaining rigorous standards and compliance.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="bg-white p-8 rounded-2xl">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center text-xl font-bold mb-6">
                  3
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Access your funds</h3>
                <p className="text-gray-600">
                  Close quickly and access your home equity. Use it for whatever matters most to you—we're here to support your goals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="get-started" className="py-24 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to unlock your home's potential?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Get a rate estimate in minutes. No credit impact, no obligation.
          </p>
          <a href="#" className="inline-block px-8 py-4 bg-gray-900 text-white text-base font-medium rounded-full hover:bg-gray-800 transition-all hover:scale-105">
            Check Your Rate Now
          </a>
          <div className="mt-6 text-sm text-gray-500">
            Licensed in 50 states · NMLS #1988098 · Equal Housing Lender
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg"></div>
                <span className="text-xl font-semibold">First Access</span>
              </div>
              <p className="text-gray-400 text-sm">
                AI-powered home equity solutions for the modern homeowner.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Products</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">HELOC</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Second Lien</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Refinance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Licensing</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-sm text-gray-400">
            <p>© 2026 First Access Lending. All rights reserved. NMLS #1988098</p>
            <p className="mt-2">
              First Access Lending is licensed to lend in all 50 states. Equal Housing Lender. Powered by advanced AI technology.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
