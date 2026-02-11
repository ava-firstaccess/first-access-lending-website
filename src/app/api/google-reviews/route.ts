import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Use the new Places API (New) - Text Search endpoint
    const searchResponse = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.reviews'
        },
        body: JSON.stringify({
          textQuery: 'First Access Lending Virginia'
        })
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Search failed: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.places || searchData.places.length === 0) {
      return NextResponse.json(
        { error: 'Business not found on Google', searchData },
        { status: 404 }
      );
    }

    const place = searchData.places[0];

    // Transform the response to match the expected format
    return NextResponse.json({
      placeId: place.id,
      name: place.displayName?.text || 'First Access Lending',
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      reviews: place.reviews?.map((review: any) => ({
        author_name: review.authorAttribution?.displayName || 'Anonymous',
        author_url: review.authorAttribution?.uri || '',
        profile_photo_url: review.authorAttribution?.photoUri || '',
        rating: review.rating,
        relative_time_description: review.relativePublishTimeDescription || '',
        text: review.text?.text || review.originalText?.text || '',
        time: review.publishTime ? new Date(review.publishTime).getTime() / 1000 : Date.now() / 1000
      })) || []
    });
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
