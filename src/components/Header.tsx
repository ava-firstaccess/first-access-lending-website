'use client';

export default function Header() {
  return (
    <header className="bg-[#003961] text-white sticky top-0 z-50 shadow-md">
      <nav className="h-[85px] max-w-7xl mx-auto px-8 flex items-center justify-between">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-[4rem] md:h-[4.25rem] w-auto"
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
