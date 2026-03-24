// Address Autocomplete - PlaceAutocompleteElement (New API)
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

// Use Google's inline bootstrapper for importLibrary support
let bootstrapped = false;

function ensureGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    if (!bootstrapped) {
      bootstrapped = true;

      // Google's recommended inline bootstrapper (minified)
      // This enables importLibrary() which is required for PlaceAutocompleteElement
      ((g: any) => {
        let h: any;
        const a: any = {};
        const k: any = {};
        const c = "google";
        const l = "importLibrary";
        const q = "__aw";
        const m = "__gmp";

        // Set up the importLibrary shim
        if (!(c in g)) (g as any)[c] = {};
        if (!(g as any)[c].maps) (g as any)[c].maps = {};
        const maps = (g as any)[c].maps;
        
        if (!maps[l]) {
          const pendingCalls: Array<{name: string; resolve: Function; reject: Function}> = [];
          
          maps[l] = (name: string) => new Promise((res, rej) => {
            pendingCalls.push({name, resolve: res, reject: rej});
          });

          // Load the actual script
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__gmcb`;
          script.async = true;
          script.onerror = () => reject(new Error('Google Maps failed to load'));
          
          // Callback when API loads
          (window as any).__gmcb = () => {
            delete (window as any).__gmcb;
            const realImport = (window as any).google.maps.importLibrary;
            // Resolve any pending calls
            if (realImport) {
              pendingCalls.forEach(({name, resolve: res, reject: rej}) => {
                realImport(name).then(res).catch(rej);
              });
            }
            resolve((window as any).google.maps);
          };
          
          document.head.appendChild(script);
        }
      })(window);
    }

    // Poll for google.maps (in case bootstrapper was already called)
    const check = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(check);
        resolve(window.google.maps);
      }
    }, 100);

    // Timeout after 10s
    setTimeout(() => {
      clearInterval(check);
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps load timeout'));
      }
    }, 10000);
  });
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

        // Now google.maps is available with importLibrary
        // Try PlaceAutocompleteElement from the places namespace
        const PAE = google.maps.places?.PlaceAutocompleteElement;

        if (!PAE) {
          console.warn('PlaceAutocompleteElement not available, using fallback');
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
