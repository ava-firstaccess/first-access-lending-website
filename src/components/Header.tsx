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
              className="h-[4rem] md:h-[4.5rem] w-auto"
            />
          </a>
        </div>
        <div className="flex gap-8 text-[15px] font-medium">
          <a href="/#products" className="hover:text-[#0EF0F0] transition-colors duration-200">Products</a>
          <a href="/#about" className="hover:text-[#0EF0F0] transition-colors duration-200">About</a>
          <a href="/#reviews" className="hover:text-[#0EF0F0] transition-colors duration-200">Reviews</a>
          <a href="/#contact" className="hover:text-[#0EF0F0] transition-colors duration-200">Contact</a>
        </div>
      </nav>
    </header>
  );
}
