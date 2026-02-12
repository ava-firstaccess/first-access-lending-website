import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/google-auth';

interface GMBAccount {
  name: string;
  accountName: string;
  type: string;
}

interface GMBLocation {
  name: string;
  title: string;
  storeCode?: string;
}

interface GMBReview {
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
  };
  starRating: string;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { 
          error: 'Not authenticated. Please authenticate at /admin/setup',
          needsAuth: true 
        },
        { status: 401 }
      );
    }

    // Step 1: Get accounts
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('Accounts fetch failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch GMB accounts', details: errorText },
        { status: accountsResponse.status }
      );
    }

    const accountsData = await accountsResponse.json();
    
    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      return NextResponse.json(
        { error: 'No GMB accounts found' },
        { status: 404 }
      );
    }

    const account: GMBAccount = accountsData.accounts[0];
    const accountName = account.name;

    // Step 2: Get locations
    const locationsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!locationsResponse.ok) {
      const errorText = await locationsResponse.text();
      console.error('Locations fetch failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch locations', details: errorText },
        { status: locationsResponse.status }
      );
    }

    const locationsData = await locationsResponse.json();

    if (!locationsData.locations || locationsData.locations.length === 0) {
      return NextResponse.json(
        { error: 'No locations found' },
        { status: 404 }
      );
    }

    const location: GMBLocation = locationsData.locations[0];
    const locationName = location.name;

    // Step 3: Get reviews
    const reviewsResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!reviewsResponse.ok) {
      const errorText = await reviewsResponse.text();
      console.error('Reviews fetch failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: errorText },
        { status: reviewsResponse.status }
      );
    }

    const reviewsData = await reviewsResponse.json();

    // Transform to match the format expected by the frontend
    const transformedReviews = (reviewsData.reviews || []).map((review: GMBReview) => ({
      author_name: review.reviewer.displayName,
      author_url: '', // GMB doesn't provide this
      profile_photo_url: review.reviewer.profilePhotoUrl || '',
      rating: parseInt(review.starRating.replace('STAR_RATING_', '').replace('_', '')),
      relative_time_description: getRelativeTime(review.createTime),
      text: review.comment || '',
      time: new Date(review.createTime).getTime() / 1000,
      reviewId: review.reviewId,
    }));

    return NextResponse.json({
      placeId: locationName,
      name: location.title,
      rating: calculateAverageRating(transformedReviews),
      user_ratings_total: transformedReviews.length,
      reviews: transformedReviews,
      source: 'gmb',
    });
  } catch (error) {
    console.error('Error fetching GMB reviews:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

function calculateAverageRating(reviews: any[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return 'today';
}
