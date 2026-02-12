import { NextResponse } from 'next/server';
import { checkAuthStatus } from '@/lib/google-auth';

export async function GET() {
  try {
    const status = await checkAuthStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json(
      { authenticated: false, hasRefreshToken: false },
      { status: 500 }
    );
  }
}
