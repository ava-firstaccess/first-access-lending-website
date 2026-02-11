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
      <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>
        ★
      </span>
    ));
  };

  return (
    <section className="bg-gradient-to-r from-[#0283DB] to-[#003961] py-12">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-white text-center mb-2">
          Our Happy Clients!
        </h2>

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
            <p className="text-xs mt-4 opacity-75">
              Please ensure NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is set in your environment
            </p>
          </div>
        )}

        {!loading && !error && placeDetails && (
          <>
            {/* Overall Rating */}
            <div className="text-center text-white mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-5xl font-bold">{placeDetails.rating.toFixed(1)}</span>
                <div>
                  <div className="text-2xl">{renderStars(Math.round(placeDetails.rating))}</div>
                </div>
              </div>
            </div>

            {/* Reviews Grid - 3 columns on desktop, 1 column on mobile */}
            {placeDetails.reviews && placeDetails.reviews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {placeDetails.reviews.slice(0, 3).map((review, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-lg p-6 flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      {review.profile_photo_url && (
                        <img
                          src={review.profile_photo_url}
                          alt={review.author_name}
                          className="w-12 h-12 rounded-full flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 truncate">
                          {review.author_name}
                        </h3>
                        <div className="text-xl mb-1">
                          {renderStars(review.rating)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {review.relative_time_description}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed flex-grow">
                      {review.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
