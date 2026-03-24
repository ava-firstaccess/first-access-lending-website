// Address Autocomplete using Google Places (New API - PlaceAutocompleteElement)
'use client';

import { useEffect, useRef } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address or city, state",
  className = ""
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Load the Google Maps Places library
    const loadPlacesLibrary = async () => {
      try {
        // @ts-ignore - Google Places API loaded via script
        const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");

        // Create the autocomplete element
        const autocomplete = new PlaceAutocompleteElement();
        autocomplete.setAttribute('placeholder', placeholder);
        autocomplete.setAttribute('country-restriction', 'us');
        
        // Style it to match our input
        Object.assign(autocomplete.style, {
          width: '100%',
          padding: '12px 16px',
          fontSize: '18px',
          border: '2px solid rgb(209, 213, 219)',
          borderRadius: '12px',
          outline: 'none'
        });

        // Listen for place selection
        autocomplete.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.place;
          if (place.formattedAddress) {
            onChange(place.formattedAddress);
          }
        });

        // Replace input with autocomplete element
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(autocomplete);
        }
      } catch (error) {
        console.error('Failed to load Places library:', error);
        // Fallback to regular input
        if (inputRef.current) {
          inputRef.current.style.display = 'block';
        }
      }
    };

    // Load Google Maps script
    if (!(window as any).google?.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => loadPlacesLibrary();
      document.head.appendChild(script);
    } else {
      loadPlacesLibrary();
    }
  }, [placeholder, onChange]);

  // Fallback regular input (hidden by default, shown if Places API fails)
  return (
    <div>
      <div ref={containerRef} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        style={{ display: 'none' }}
      />
    </div>
  );
}
