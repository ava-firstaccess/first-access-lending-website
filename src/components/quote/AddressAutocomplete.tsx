// Address Input Component (Plain text for now - Google Places API not enabled)
'use client';

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
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}

// TODO: Enable Google Places API in Google Cloud Console to re-enable autocomplete
// Error: ApiNotActivatedMapError - Places API not activated for this project
// Steps: Google Cloud Console → APIs & Services → Enable APIs → Places API
