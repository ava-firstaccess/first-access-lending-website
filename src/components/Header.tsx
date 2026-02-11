'use client';

export default function Header() {
  return (
    <header className="backdrop-blur-md bg-white/90 text-[#000C14] sticky top-0 z-50 shadow-sm transition-all duration-300">
      <nav className="h-[54px] max-w-7xl mx-auto px-8 flex items-center justify-between">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-[5.625rem] md:h-[9rem] w-auto"
            />
          </a>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex gap-8 text-[20px] font-medium">
            <a href="/#products" className="hover:text-[#0283DB] transition-colors duration-200">Products</a>
            <a href="/#about" className="hover:text-[#0283DB] transition-colors duration-200">About</a>
            <a href="/#reviews" className="hover:text-[#0283DB] transition-colors duration-200">Reviews</a>
            <a href="/#contact" className="hover:text-[#0283DB] transition-colors duration-200">Contact</a>
          </div>
          <a 
            href="/heloc" 
            className="bg-[#0283DB] text-white px-6 py-2.5 rounded-full font-medium text-[22px] hover:bg-[#003961] transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Access my HELOC Rate
          </a>
        </div>
      </nav>
    </header>
  );
}
