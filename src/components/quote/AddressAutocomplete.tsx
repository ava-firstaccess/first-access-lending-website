// Address Autocomplete - PlaceAutocompleteElement (New API, required for new customers since March 2025)
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

// Singleton script loader
let scriptLoaded = false;
let scriptLoading = false;
const callbacks: (() => void)[] = [];

function ensureGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (scriptLoaded && window.google?.maps) {
      resolve();
      return;
    }
    if (scriptLoading) {
      callbacks.push(() => resolve());
      return;
    }
    scriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      callbacks.forEach(cb => cb());
      callbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address or city, state",
  className = ""
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);
  const elementRef = useRef<any>(null);

  const handleChange = useCallback((address: string) => {
    onChange(address);
  }, [onChange]);

  useEffect(() => {
    if (initRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey || !containerRef.current) return;

    initRef.current = true;

    ensureGoogleMaps(apiKey).then(async () => {
      if (!containerRef.current) return;

      // Wait for the places library to be fully ready
      try {
        await google.maps.importLibrary('places');
      } catch {
        // importLibrary may not be available, continue anyway
      }

      // Check if PlaceAutocompleteElement is available
      if (!google.maps.places?.PlaceAutocompleteElement) {
        console.warn('PlaceAutocompleteElement not available, using fallback input');
        return;
      }

      // Create the PlaceAutocompleteElement
      const autocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: 'us' },
        types: ['address'],
      });

      elementRef.current = autocomplete;

      // Style the element to match our design
      const el = autocomplete as unknown as HTMLElement;
      el.style.width = '100%';

      // Listen for place selection
      autocomplete.addEventListener('gmp-placeselect', async (event: any) => {
        const place = event.place;
        if (place) {
          // Fetch the full place details
          try {
            await place.fetchFields({ fields: ['formattedAddress', 'addressComponents'] });
            if (place.formattedAddress) {
              handleChange(place.formattedAddress);
              // Hide fallback input
              if (fallbackInputRef.current) {
                fallbackInputRef.current.style.display = 'none';
              }
            }
          } catch {
            // If fetchFields fails, try displayName
            if (place.displayName) {
              handleChange(place.displayName);
            }
          }
        }
      });

      // Also capture typed text via input events on the inner input
      autocomplete.addEventListener('gmp-input', () => {
        // User is typing - we can capture this if needed
      });

      // Hide fallback, show autocomplete
      if (fallbackInputRef.current) {
        fallbackInputRef.current.style.display = 'none';
      }
      containerRef.current.insertBefore(el, containerRef.current.firstChild);

    }).catch((err) => {
      console.warn('Autocomplete unavailable, using plain input:', err);
    });

    return () => {
      // Cleanup
      if (elementRef.current) {
        try {
          const el = elementRef.current as unknown as HTMLElement;
          el.remove();
        } catch {
          // ignore
        }
      }
    };
  }, [handleChange]);

  // Fallback input - shown if Google API fails or during loading
  return (
    <div ref={containerRef} className="w-full">
      <input
        ref={fallbackInputRef}
        type="text"
        defaultValue={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <style jsx global>{`
        /* Style the Google PlaceAutocompleteElement to match our design */
        gmp-place-autocomplete {
          width: 100%;
          --gmpx-color-surface: white;
          --gmpx-color-on-surface: #111827;
          --gmpx-color-primary: #2563eb;
          --gmpx-font-family-base: inherit;
          --gmpx-font-size-base: 1.125rem;
        }
        gmp-place-autocomplete input {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 1.125rem;
          border: 2px solid #d1d5db;
          border-radius: 0.75rem;
          outline: none;
          transition: border-color 0.15s;
        }
        gmp-place-autocomplete input:focus {
          border-color: #2563eb;
        }
      `}</style>
    </div>
  );
}
