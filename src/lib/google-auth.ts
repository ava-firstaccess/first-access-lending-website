import { promises as fs } from 'fs';
import path from 'path';

interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  created_at: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

const TOKENS_PATH = path.join('/tmp', '.google-oauth-tokens.json');

export async function getValidAccessToken(): Promise<string | null> {
  try {
    // Read stored tokens
    const tokensData = await fs.readFile(TOKENS_PATH, 'utf-8');
    const tokens: StoredTokens = JSON.parse(tokensData);

    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (tokens.expires_at > now + bufferMs) {
      // Token is still valid
      return tokens.access_token;
    }

    // Token expired, refresh it
    if (!tokens.refresh_token) {
      console.error('No refresh token available');
      return null;
    }

    return await refreshAccessToken(tokens.refresh_token);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('OAuth credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token refresh failed:', errorData);
      return null;
    }

    const tokens: TokenResponse = await response.json();

    // Update stored tokens
    const storedTokens: StoredTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken, // Keep old refresh token if new one not provided
      expires_at: Date.now() + (tokens.expires_in * 1000),
      created_at: Date.now(),
    };

    await fs.writeFile(TOKENS_PATH, JSON.stringify(storedTokens, null, 2));

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function checkAuthStatus(): Promise<{
  authenticated: boolean;
  hasRefreshToken: boolean;
  expiresAt?: number;
}> {
  try {
    const tokensData = await fs.readFile(TOKENS_PATH, 'utf-8');
    const tokens: StoredTokens = JSON.parse(tokensData);

    return {
      authenticated: true,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expires_at,
    };
  } catch (error) {
    return {
      authenticated: false,
      hasRefreshToken: false,
    };
  }
}
