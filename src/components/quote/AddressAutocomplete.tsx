// Address Autocomplete - uses AutocompleteService (no web component, no shadow DOM)
// Our own input + our own dropdown, Google only provides the suggestions
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  placeId: string;
  description: string;
}

let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.AutocompleteService) {
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
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const [ready, setReady] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load Google Maps and init service
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    loadGoogleMaps(apiKey).then(() => {
      serviceRef.current = new google.maps.places.AutocompleteService();
      setReady(true);
    }).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch suggestions when user types
  const fetchSuggestions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 3) {
      setSuggestions([]);
      return;
    }

    serviceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'us' },
        types: ['address'],
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(
            predictions.map(p => ({
              placeId: p.place_id,
              description: p.description,
            }))
          );
          setShowDropdown(true);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setSelected(false);
    onChange(''); // Clear until they select

    // Debounce API calls
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (suggestion: Suggestion) => {
    setInputValue(suggestion.description);
    setSelected(true);
    setShowDropdown(false);
    setSuggestions([]);
    onChange(suggestion.description);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={handleInput}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder || 'Enter address or city, state'}
        className={`w-full px-4 py-3 text-lg border-2 rounded-xl focus:outline-none transition-colors ${
          selected
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 focus:border-blue-600'
        }`}
        autoComplete="off"
      />

      {/* Confirmed address indicator */}
      {selected && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              onClick={() => handleSelect(s)}
              className="px-4 py-3 cursor-pointer hover:bg-blue-50 text-gray-800 text-sm border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {s.description}
              </div>
            </li>
          ))}
          <li className="px-4 py-2 text-xs text-gray-400 text-right">
            Powered by Google
          </li>
        </ul>
      )}

      {!ready && (
        <p className="text-xs text-gray-400 mt-1">Loading address search...</p>
      )}
    </div>
  );
}
