'use client';

import { useState } from 'react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="backdrop-blur-md bg-white/90 text-[#000C14] sticky top-0 z-50 shadow-sm transition-all duration-300">
      <nav className="h-[75px] max-w-7xl mx-auto px-8 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-[4.78rem] md:h-[7.65rem] w-auto"
            />
          </a>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex gap-8 text-[15px] font-medium">
            <a href="/#products" className="hover:text-[#0283DB] transition-colors duration-200">Products</a>
            <a href="/about" className="hover:text-[#0283DB] transition-colors duration-200">About</a>
            <a href="/#reviews" className="hover:text-[#0283DB] transition-colors duration-200">Reviews</a>
            <a href="/#contact" className="hover:text-[#0283DB] transition-colors duration-200">Contact</a>
          </div>
          <a 
            href="/heloc" 
            className="bg-[#0283DB] text-white px-5 py-2 rounded-full font-medium text-base hover:bg-[#003961] transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap"
          >
            Access my HELOC Rate
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#000C14] hover:text-[#0283DB] transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg">
          <div className="flex flex-col px-8 py-4 space-y-4">
            <a 
              href="/#products" 
              className="text-sm font-medium hover:text-[#0283DB] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Products
            </a>
            <a 
              href="/about" 
              className="text-sm font-medium hover:text-[#0283DB] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </a>
            <a 
              href="/#reviews" 
              className="text-sm font-medium hover:text-[#0283DB] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Reviews
            </a>
            <a 
              href="/#contact" 
              className="text-sm font-medium hover:text-[#0283DB] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </a>
            <a 
              href="/heloc" 
              className="bg-[#0283DB] text-white px-5 py-2.5 rounded-full font-medium text-sm hover:bg-[#003961] transition-all duration-200 shadow-md text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Access my HELOC Rate
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
