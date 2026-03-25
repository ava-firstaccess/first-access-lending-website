// Address Autocomplete - PlaceAutocompleteElement with correct event handling
// Fix: gmp-select (not gmp-placeselect), placePrediction.toPlace() (not event.place)
'use client';

import { useEffect, useRef } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, state?: string) => void;
  placeholder?: string;
  className?: string;
}

let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      resolve();
      return;
    }
    const cb = '_gmReady';
    (window as any)[cb] = () => { delete (window as any)[cb]; resolve(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${cb}`;
    s.async = true;
    s.onerror = () => { loadPromise = null; reject(new Error('Maps load failed')); };
    document.head.appendChild(s);
  });
  return loadPromise;
}

export default function AddressAutocomplete({ value, onChange, placeholder, className }: AddressAutocompleteProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey || !hostRef.current) return;

    (async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (disposed || !hostRef.current || acRef.current) return;

        const PAE = google.maps.places.PlaceAutocompleteElement;
        if (!PAE) return;

        const ac = new PAE({
          componentRestrictions: { country: 'us' },
          types: ['address'],
        }) as any; // Cast: TS types lag behind runtime API (value/placeholder)
        acRef.current = ac;

        // Correct event: gmp-select (NOT gmp-placeselect)
        // Correct data: event.placePrediction.toPlace() (NOT event.place)
        const handleSelect = async (evt: Event) => {
          try {
            const e = evt as any;
            const place = e.placePrediction.toPlace();
            await place.fetchFields({ fields: ['formattedAddress', 'addressComponents'] });
            const address = place.formattedAddress || ac.value || '';
            // Extract state from address components
            let state: string | undefined;
            if (place.addressComponents) {
              for (const comp of place.addressComponents) {
                if (comp.types?.includes('administrative_area_level_1')) {
                  state = comp.shortText || comp.short_name || undefined;
                  break;
                }
              }
            }
            if (address) onChangeRef.current(address, state);
          } catch (err) {
            const fallback = ac.value || '';
            if (fallback) onChangeRef.current(fallback);
            console.warn('Place selection fallback:', err);
          }
        };

        ac.addEventListener('gmp-select', handleSelect);

        if (placeholder) ac.placeholder = placeholder;
        if (value) ac.value = value;

        hostRef.current.appendChild(ac as unknown as Node);

        cleanup = () => {
          ac.removeEventListener('gmp-select', handleSelect);
          (ac as unknown as HTMLElement).remove();
          acRef.current = null;
        };
      } catch (err) {
        console.warn('Autocomplete failed to load:', err);
      }
    })();

    return () => { disposed = true; cleanup?.(); };
  }, []);

  // Sync value prop to element
  useEffect(() => {
    if (acRef.current && acRef.current.value !== (value ?? '')) {
      acRef.current.value = value ?? '';
    }
  }, [value]);

  return (
    <div ref={hostRef}>
      <style jsx global>{`
        gmp-place-autocomplete {
          width: 100%;
          display: block;
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
          background: white;
        }
        gmp-place-autocomplete input:focus {
          border-color: #2563eb;
        }
      `}</style>
    </div>
  );
}
