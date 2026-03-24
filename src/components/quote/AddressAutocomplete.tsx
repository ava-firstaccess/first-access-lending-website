// Address Autocomplete - uncontrolled input (Google manages DOM directly)
'use client';

import { useEffect, useRef } from 'react';

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
    if (scriptLoaded && window.google?.maps?.places) {
      resolve();
      return;
    }
    if (scriptLoading) {
      callbacks.push(() => resolve());
      return;
    }
    scriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const initRef = useRef(false);

  // Sync initial value to uncontrolled input
  useEffect(() => {
    if (inputRef.current && value && !inputRef.current.value) {
      inputRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    if (!inputRef.current || initRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    initRef.current = true;

    ensureGoogleMaps(apiKey).then(() => {
      if (!inputRef.current) return;

      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          onChange(place.formatted_address);
        }
      });
    }).catch((err) => {
      console.warn('Autocomplete unavailable:', err);
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onChange]);

  // Uncontrolled input - no value prop, Google manages it directly
  // onInput syncs typed text to React state (for Continue button enable)
  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
