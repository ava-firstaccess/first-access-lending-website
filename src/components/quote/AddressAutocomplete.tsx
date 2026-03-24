// Address Autocomplete - only accepts validated selections from Google dropdown
'use client';

import { useEffect, useRef, useState } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const initialized = useRef(false);
  const [confirmed, setConfirmed] = useState(!!value);
  const [displayAddress, setDisplayAddress] = useState(value || '');

  onChangeRef.current = onChange;

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;
    initialized.current = true;

    loadGoogleMaps(apiKey).then(() => {
      if (!containerRef.current) return;
      const PAE = google.maps.places?.PlaceAutocompleteElement;
      if (!PAE) return;

      const ac = new PAE({
        componentRestrictions: { country: 'us' },
        types: ['address'],
      });

      // ONLY fire onChange when user selects from dropdown
      ac.addEventListener('gmp-placeselect', async (e: any) => {
        const place = e.place;
        if (!place) return;

        let address = '';
        try {
          await place.fetchFields({ fields: ['formattedAddress'] });
          address = place.formattedAddress || '';
        } catch {
          // Read from the element's visible input as fallback
          const input = (ac as unknown as HTMLElement).shadowRoot?.querySelector('input');
          address = input?.value || '';
        }

        if (address) {
          setDisplayAddress(address);
          setConfirmed(true);
          onChangeRef.current(address);
        }
      });

      // When user types (clears a previous selection), un-confirm
      (ac as unknown as HTMLElement).addEventListener('input', () => {
        if (confirmed) {
          setConfirmed(false);
          onChangeRef.current(''); // Clear the value so Continue disables
        }
      });

      const el = ac as unknown as HTMLElement;
      el.style.width = '100%';
      const fallback = containerRef.current.querySelector('input');
      if (fallback) fallback.style.display = 'none';
      containerRef.current.insertBefore(el, containerRef.current.firstChild);

    }).catch(err => console.warn('Maps failed:', err));
  }, []);

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
      {confirmed && displayAddress && (
        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {displayAddress}
        </p>
      )}
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
