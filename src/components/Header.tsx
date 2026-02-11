'use client';

export default function Header() {
  return (
    <header className="backdrop-blur-md bg-[#003961]/80 text-white sticky top-0 z-50 shadow-md transition-all duration-300">
      <nav className="h-[88px] max-w-7xl mx-auto px-8 flex items-center justify-between">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-[3.5rem] md:h-[3.75rem] w-auto"
            />
          </a>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex gap-8 text-[15px] font-medium">
            <a href="/#products" className="hover:text-[#0EF0F0] transition-colors duration-200">Products</a>
            <a href="/#about" className="hover:text-[#0EF0F0] transition-colors duration-200">About</a>
            <a href="/#reviews" className="hover:text-[#0EF0F0] transition-colors duration-200">Reviews</a>
            <a href="/#contact" className="hover:text-[#0EF0F0] transition-colors duration-200">Contact</a>
          </div>
          <a 
            href="/heloc" 
            className="bg-[#0EF0F0] text-[#003961] px-6 py-2.5 rounded-full font-semibold text-[15px] hover:bg-[#0283DB] hover:text-white transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Access my HELOC Rate
          </a>
        </div>
      </nav>
    </header>
  );
}
