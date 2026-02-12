'use client';

import { useEffect, useState } from 'react';

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url?: string;
  relative_time_description: string;
}

interface PlaceDetails {
  rating: number;
  user_ratings_total: number;
  reviews: Review[];
}

export default function CustomGoogleReviews() {
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewsPerView, setReviewsPerView] = useState(4);

  // Handle responsive reviews per view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setReviewsPerView(1); // Mobile: 1 review
      } else if (window.innerWidth < 768) {
        setReviewsPerView(2); // Small tablet: 2 reviews
      } else if (window.innerWidth < 1024) {
        setReviewsPerView(3); // Tablet: 3 reviews
      } else {
        setReviewsPerView(4); // Desktop: 4 reviews
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await fetch('/api/google-reviews');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch reviews');
        }

        const data = await response.json();
        setPlaceDetails(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching Google reviews:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-[#FFA500]' : 'text-gray-600'}>
        ★
      </span>
    ));
  };

  const reviews = placeDetails?.reviews || [];
  
  // Create infinite loop by duplicating reviews
  const infiniteReviews = reviews.length > 0 ? [...reviews, ...reviews, ...reviews] : [];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const truncateText = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const getCurrentReviews = () => {
    if (reviews.length === 0) return [];
    
    // Get reviews starting from currentIndex, wrapping around
    const result = [];
    for (let i = 0; i < reviewsPerView; i++) {
      const index = (currentIndex + i) % reviews.length;
      result.push(reviews[index]);
    }
    return result;
  };

  return (
    <section className="bg-[#0f0f1e] py-12">
      <div className="max-w-7xl mx-auto px-6">
        {loading && (
          <div className="text-white text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4">Loading reviews...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-300 text-white rounded-lg p-6 text-center">
            <p className="font-semibold">Unable to load Google reviews</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        )}

        {!loading && !error && placeDetails && (
          <div className="bg-[#1a1a2e] rounded-2xl p-6 shadow-2xl">
            {/* Header with Google Logo and Rating */}
            <div className="flex items-center gap-3 mb-6">
              {/* Google Logo */}
              <svg className="w-8 h-8" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              
              <div>
                <h2 className="text-xl font-bold text-white">Google Reviews</h2>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{placeDetails.rating.toFixed(1)}</span>
                  <div className="text-base">
                    {renderStars(Math.round(placeDetails.rating))}
                  </div>
                </div>
              </div>
            </div>

            {/* Infinite Carousel */}
            {reviews.length > 0 && (
              <div className="relative">
                {/* Navigation Arrows */}
                <button
                  onClick={prevSlide}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                  aria-label="Previous reviews"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={nextSlide}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                  aria-label="Next reviews"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Review Cards - Responsive Grid */}
                <div className="px-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getCurrentReviews().map((review, index) => (
                      <div 
                        key={`${currentIndex}-${index}`} 
                        className="bg-[#2a2a3e] rounded-xl p-4 shadow-xl flex flex-col"
                      >
                        {/* Stars */}
                        <div className="text-xl mb-2">
                          {renderStars(review.rating)}
                        </div>

                        {/* Review Text */}
                        <div className="flex-grow mb-3">
                          <p className="text-white text-sm leading-relaxed">
                            {truncateText(review.text, 120)}
                          </p>
                        </div>

                        {/* Author Info */}
                        <div className="flex items-center gap-2 mt-auto">
                          {review.profile_photo_url && (
                            <img
                              src={review.profile_photo_url}
                              alt={review.author_name}
                              className="w-10 h-10 rounded-full border-2 border-white/20"
                            />
                          )}
                          <div>
                            <p className="text-white font-bold text-sm">{review.author_name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indicator Dots */}
                <div className="flex justify-center gap-2 mt-6">
                  {reviews.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentIndex 
                          ? 'bg-[#4A90E2] w-6' 
                          : 'bg-white/30 hover:bg-white/50'
                      }`}
                      aria-label={`Go to review ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
