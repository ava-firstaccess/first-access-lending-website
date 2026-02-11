'use client';

export default function Header() {
  return (
    <header className="bg-[#003961] text-white sticky top-0 z-50 shadow-lg">
      <nav className="h-[70px] max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center">
          <a href="/">
            <img 
              src="/logos/fal-logo.svg" 
              alt="First Access Lending" 
              className="h-[2.5rem] md:h-[3rem] w-auto"
            />
          </a>
        </div>
        <div className="flex gap-6 text-sm">
          <a href="/#products" className="hover:text-[#0EF0F0] transition">Products</a>
          <a href="/#about" className="hover:text-[#0EF0F0] transition">About</a>
          <a href="/#reviews" className="hover:text-[#0EF0F0] transition">Reviews</a>
          <a href="/#contact" className="hover:text-[#0EF0F0] transition">Contact</a>
        </div>
      </nav>
    </header>
  );
}
