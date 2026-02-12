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

    // First, find the place using Place Search
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=First%20Access%20Lending%20Virginia&inputtype=textquery&fields=place_id&key=${apiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Search failed: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.candidates || searchData.candidates.length === 0) {
      return NextResponse.json(
        { error: 'Business not found on Google' },
        { status: 404 }
      );
    }

    const placeId = searchData.candidates[0].place_id;

    // Now fetch place details with all reviews (legacy API returns up to 5 by default, but we can get the most relevant ones)
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);

    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      throw new Error(`Details fetch failed: ${detailsResponse.status} - ${errorText}`);
    }

    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result) {
      return NextResponse.json(
        { error: `API returned status: ${detailsData.status}` },
        { status: 500 }
      );
    }

    const place = detailsData.result;

    // Return the data
    return NextResponse.json({
      name: place.name,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      reviews: place.reviews || []
    });
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
