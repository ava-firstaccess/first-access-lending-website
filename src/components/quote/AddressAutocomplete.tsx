// Address Autocomplete using Google PlaceAutocompleteElement
// Clean rewrite - no shadow DOM hacking, no polling
'use client';

import { useEffect, useRef } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

// Load Google Maps once, resolve via callback when fully ready
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
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const initialized = useRef(false);

  // Keep onChange ref current (avoids stale closure issue)
  onChangeRef.current = onChange;

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;
    initialized.current = true;

    loadGoogleMaps(apiKey).then(() => {
      if (!containerRef.current) return;
      const PAE = google.maps.places?.PlaceAutocompleteElement;
      if (!PAE) { console.warn('PlaceAutocompleteElement unavailable'); return; }

      const ac = new PAE({
        componentRestrictions: { country: 'us' },
        types: ['address'],
      });

      // When user selects a place from dropdown
      ac.addEventListener('gmp-placeselect', async (e: any) => {
        const place = e.place;
        if (!place) return;
        try {
          await place.fetchFields({ fields: ['formattedAddress'] });
          if (place.formattedAddress) { onChangeRef.current(place.formattedAddress); return; }
        } catch { /* fall through */ }
        // Fallback: read whatever text the element is showing
        const input = (ac as any).inputElement ?? (ac as unknown as HTMLElement).shadowRoot?.querySelector('input');
        if (input?.value) onChangeRef.current(input.value);
      });

      // Typing: input events bubble out of shadow DOM
      (ac as unknown as HTMLElement).addEventListener('input', () => {
        const input = (ac as any).inputElement ?? (ac as unknown as HTMLElement).shadowRoot?.querySelector('input');
        if (input?.value) onChangeRef.current(input.value);
      });

      // Insert and hide fallback
      const el = ac as unknown as HTMLElement;
      el.style.width = '100%';
      const fallback = containerRef.current.querySelector('input');
      if (fallback) fallback.style.display = 'none';
      containerRef.current.insertBefore(el, containerRef.current.firstChild);

    }).catch(err => console.warn('Maps failed:', err));
  }, []);

  // Fallback plain input (shown until Google loads, or if it fails)
  return (
    <div ref={containerRef} className="w-full">
      <input
        type="text"
        defaultValue={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder || 'Enter address or city, state'}
        className={className || ''}
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
