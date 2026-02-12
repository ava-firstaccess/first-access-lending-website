'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface AuthStatus {
  authenticated: boolean;
  hasRefreshToken: boolean;
  expiresAt?: number;
}

function AdminSetupContent() {
  const searchParams = useSearchParams();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check for OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      setMessage({ type: 'success', text: 'Successfully authenticated with Google!' });
    } else if (error) {
      const details = searchParams.get('details');
      const errorMessages: Record<string, string> = {
        no_code: 'No authorization code received',
        missing_credentials: 'OAuth credentials not configured',
        token_exchange_failed: details 
          ? `Failed to exchange authorization code for tokens. Google error: ${details}`
          : 'Failed to exchange authorization code for tokens',
        server_error: 'Server error during authentication',
      };
      setMessage({ 
        type: 'error', 
        text: errorMessages[error] || `Authentication error: ${error}` 
      });
    }

    // Load current auth status
    loadAuthStatus();
  }, [searchParams]);

  const loadAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Failed to load auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = () => {
    window.location.href = '/api/auth/google/login';
  };

  const formatExpiryDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Google My Business Setup
          </h1>

          {message && (
            <div
              className={`mb-6 p-4 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading authentication status...</p>
            </div>
          ) : (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Current Status
                </h2>
                <div className="bg-gray-50 rounded-md p-4 space-y-2">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-40">Authentication:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        authStatus?.authenticated
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {authStatus?.authenticated ? 'Authenticated' : 'Not Authenticated'}
                    </span>
                  </div>
                  {authStatus?.authenticated && (
                    <>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-40">Refresh Token:</span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            authStatus?.hasRefreshToken
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {authStatus?.hasRefreshToken ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                      {authStatus?.expiresAt && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 w-40">Token Expires:</span>
                          <span className="text-gray-600 text-sm">
                            {formatExpiryDate(authStatus.expiresAt)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Instructions
                </h2>
                <div className="prose text-gray-600 space-y-3">
                  <p>
                    This setup allows First Access Lending to fetch more than 5 Google reviews
                    using the Google My Business API.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>Click the "Authenticate with Google" button below</li>
                    <li>Sign in with the Google account that owns the business listing</li>
                    <li>Grant permission to access Google My Business data</li>
                    <li>You'll be redirected back to this page upon success</li>
                  </ol>
                  <p className="text-sm text-gray-500 mt-4">
                    Note: This authentication only needs to be done once. The system will
                    automatically refresh the access token as needed.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleAuthenticate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {authStatus?.authenticated ? 'Re-authenticate' : 'Authenticate with Google'}
                </button>
                
                {authStatus?.authenticated && (
                  <button
                    onClick={loadAuthStatus}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Refresh Status
                  </button>
                )}
              </div>

              {authStatus?.authenticated && (
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <h3 className="font-semibold text-blue-900 mb-2">Test the Integration</h3>
                  <p className="text-blue-800 text-sm mb-3">
                    Visit the API endpoint to see if reviews are being fetched:
                  </p>
                  <a
                    href="/api/gmb-reviews"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    Test GMB Reviews API
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Security Note</h3>
          <p className="text-yellow-800 text-sm">
            This page should be protected in production. Consider adding authentication
            or moving it behind a password-protected admin panel.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminSetup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow rounded-lg p-8">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <AdminSetupContent />
    </Suspense>
  );
}
