// Address Autocomplete - PlaceAutocompleteElement (New API)
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

// Singleton: resolve ONLY via callback (no polling - prevents race condition)
let mapsPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    // Already loaded from another source
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      resolve();
      return;
    }

    const callbackName = '__gm_autocomplete_cb_' + Date.now();
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      delete (window as any)[callbackName];
      mapsPromise = null;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
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
        await loadGoogleMaps(apiKey);

        const PAE = google.maps.places?.PlaceAutocompleteElement;
        if (!PAE) {
          console.warn('PlaceAutocompleteElement not available after load');
          return;
        }

        if (!containerRef.current) return;

        const autocomplete = new PAE({
          componentRestrictions: { country: 'us' },
          types: ['address'],
        });

        const el = autocomplete as unknown as HTMLElement;
        el.style.width = '100%';

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

        // Capture typing in the shadow DOM input to enable Continue button
        const observer = new MutationObserver(() => {
          const shadowInput = el.shadowRoot?.querySelector('input');
          if (shadowInput) {
            observer.disconnect();
            shadowInput.addEventListener('input', () => {
              handleChange(shadowInput.value);
            });
            // Set placeholder
            shadowInput.placeholder = placeholder;
          }
        });
        observer.observe(el, { childList: true, subtree: true });
        // Also check immediately (shadow DOM may already be ready)
        setTimeout(() => {
          const shadowInput = el.shadowRoot?.querySelector('input');
          if (shadowInput) {
            observer.disconnect();
            shadowInput.addEventListener('input', () => {
              handleChange(shadowInput.value);
            });
            shadowInput.placeholder = placeholder;
          }
        }, 500);

        // Hide fallback, insert autocomplete element
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
