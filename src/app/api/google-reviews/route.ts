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

    // First, search for the business to get the Place ID
    const searchResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=First+Access+Lending+Virginia&key=${apiKey}`
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for business');
    }

    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' || !searchData.results?.[0]) {
      return NextResponse.json(
        { error: 'Business not found on Google', searchData },
        { status: 404 }
      );
    }

    const placeId = searchData.results[0].place_id;

    // Fetch place details with reviews
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`
    );

    if (!detailsResponse.ok) {
      throw new Error('Failed to fetch reviews');
    }

    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK') {
      return NextResponse.json(
        { error: `API Error: ${detailsData.status}`, details: detailsData },
        { status: 500 }
      );
    }

    // Return the place details
    return NextResponse.json({
      placeId,
      ...detailsData.result,
    });
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
