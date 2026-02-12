'use client';

import { useState, useEffect } from 'react';

const reviews = [
  {
    name: "Sophia A.",
    location: "San Antonio, TX",
    text: "Smooth & Efficient Home Buying!",
    rating: 5
  },
  {
    name: "M.",
    location: "Alexandria, VA",
    text: "Easy, trustworthy & stress free",
    rating: 5
  },
  {
    name: "David",
    location: "Alexandria, VA",
    text: "Helpful, honest guidance",
    rating: 5
  },
  {
    name: "Ian",
    location: "Baltimore, MD",
    text: "Fast process, and a lot of options",
    rating: 5
  },
  {
    name: "Anonymous",
    location: "US",
    text: "Patient & Customizable",
    rating: 5
  }
];

export default function ReviewCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % reviews.length);
    }, 4000); // Change review every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const review = reviews[currentIndex];

  return (
    <section className="bg-gradient-to-r from-[#0283DB] to-[#003961] py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center text-white transition-all duration-500 ease-in-out">
          <div className="flex justify-center mb-4">
            <div className="flex text-[#0EF0F0]">
              {[...Array(review.rating)].map((_, i) => (
                <svg key={i} className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-medium mb-4 italic">
            "{review.text}"
          </p>
          <p className="text-lg font-semibold">
            ,  {review.name}
          </p>
          <p className="text-sm opacity-90">
            {review.location}
          </p>
          
          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {reviews.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'bg-[#0EF0F0] w-6' : 'bg-white/50'
                }`}
                aria-label={`Go to review ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
