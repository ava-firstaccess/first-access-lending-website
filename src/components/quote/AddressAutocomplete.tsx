// Address Autocomplete - PlaceAutocompleteElement (New API)
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

// Singleton: load Google Maps bootstrap, then use importLibrary
let mapsReady: Promise<void> | null = null;

function ensureGoogleMaps(apiKey: string): Promise<void> {
  if (mapsReady) return mapsReady;

  mapsReady = new Promise((resolve, reject) => {
    // If already loaded (e.g. from another component), resolve immediately
    if (typeof window.google?.maps?.importLibrary === 'function') {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsReady = null;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return mapsReady;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address or city, state",
  className = ""
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  const handleChange = useCallback((address: string) => {
    onChange(address);
  }, [onChange]);

  useEffect(() => {
    if (initRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey || !containerRef.current) return;

    initRef.current = true;

    (async () => {
      try {
        await ensureGoogleMaps(apiKey);

        // Import the places library - returns the module with all classes
        const placesLib: any = await google.maps.importLibrary('places');
        const { PlaceAutocompleteElement } = placesLib;

        if (!PlaceAutocompleteElement) {
          console.warn('PlaceAutocompleteElement not in places library, using fallback');
          return;
        }

        if (!containerRef.current) return;

        // Create autocomplete element
        const autocomplete = new PlaceAutocompleteElement({
          componentRestrictions: { country: 'us' },
          types: ['address'],
        });

        // Style it
        const el = autocomplete as unknown as HTMLElement;
        el.style.width = '100%';

        // Listen for place selection
        autocomplete.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.place;
          if (place) {
            try {
              await place.fetchFields({ fields: ['formattedAddress', 'addressComponents'] });
              if (place.formattedAddress) {
                handleChange(place.formattedAddress);
              }
            } catch {
              if (place.displayName) {
                handleChange(place.displayName);
              }
            }
          }
        });

        // Hide fallback, show autocomplete
        if (fallbackRef.current) {
          fallbackRef.current.style.display = 'none';
        }
        containerRef.current.insertBefore(el, containerRef.current.firstChild);

      } catch (err) {
        console.warn('Autocomplete unavailable, using plain input:', err);
      }
    })();
  }, [handleChange]);

  return (
    <div ref={containerRef} className="w-full">
      <input
        ref={fallbackRef}
        type="text"
        defaultValue={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <style jsx global>{`
        gmp-place-autocomplete {
          width: 100%;
        }
        gmp-place-autocomplete input {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 1.125rem;
          border: 2px solid #d1d5db;
          border-radius: 0.75rem;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        gmp-place-autocomplete input:focus {
          border-color: #2563eb;
        }
      `}</style>
    </div>
  );
}
