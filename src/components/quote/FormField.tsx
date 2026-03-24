// Reusable Form Field Components
'use client';

import { ChangeEvent, useRef } from 'react';

interface BaseFieldProps {
  label: string;
  name: string;
  value: any;
  onChange: (name: string, value: any) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

// Text Input
interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
  autoComplete?: string;
}

export function TextField({
  label,
  name,
  value,
  onChange,
  required = false,
  type = 'text',
  placeholder,
  className = '',
  disabled = false,
  autoComplete
}: TextFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

// Date Input (manual-typeable MM/DD/YYYY + calendar icon for native picker)
interface DateFieldProps extends BaseFieldProps {
  min?: string;
  max?: string;
  autoComplete?: string;
}

export function DateField({
  label,
  name,
  value,
  onChange,
  required = false,
  min,
  max,
  className = '',
  disabled = false,
  autoComplete
}: DateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  // Display as MM/DD/YYYY for typing, store as YYYY-MM-DD
  const toDisplay = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return iso;
  };
  const toISO = (display: string) => {
    const digits = display.replace(/\D/g, '');
    if (digits.length === 8) {
      const mm = digits.slice(0, 2);
      const dd = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  };
  const formatDisplay = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDisplay(e.target.value);
    const iso = toISO(formatted);
    onChange(name, iso || formatted);
  };

  const handlePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) onChange(name, e.target.value);
  };

  const displayValue = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? toDisplay(value) : (value || '');

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleTextChange}
          placeholder="MM/DD/YYYY"
          required={required}
          disabled={disabled}
          autoComplete={autoComplete || 'bday'}
          maxLength={10}
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
        />
        {/* Calendar icon that IS the native date input */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <input
            ref={pickerRef}
            type="date"
            value={value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
            onChange={handlePickerChange}
            min={min}
            max={max}
            disabled={disabled}
            tabIndex={-1}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <svg className="w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Currency Input (formatted as $X,XXX.XX)
interface CurrencyFieldProps extends BaseFieldProps {
  placeholder?: string;
}

export function CurrencyField({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder,
  className = '',
  disabled = false
}: CurrencyFieldProps) {
  const formatCurrency = (val: string) => {
    // Remove non-numeric characters
    const numeric = val.replace(/[^\d.]/g, '');
    // Convert to number
    const num = parseFloat(numeric);
    if (isNaN(num)) return '';
    // Format with commas
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, '');
    onChange(name, rawValue ? parseFloat(rawValue) : undefined);
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-gray-500">$</span>
        <input
          type="text"
          value={value !== undefined && value !== null ? formatCurrency(String(value)) : ''}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
    </div>
  );
}

// Number Input
interface NumberFieldProps extends BaseFieldProps {
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function NumberField({
  label,
  name,
  value,
  onChange,
  required = false,
  min,
  max,
  step,
  placeholder,
  className = '',
  disabled = false
}: NumberFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="number"
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(name, e.target.value ? parseFloat(e.target.value) : undefined)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

// Dropdown Select
interface SelectFieldProps extends BaseFieldProps {
  options: { value: string | number; label: string }[];
  placeholder?: string;
  autoComplete?: string;
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  required = false,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  autoComplete
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Radio Button Group
interface RadioFieldProps extends BaseFieldProps {
  options: { value: string | number; label: string; description?: string }[];
  inline?: boolean;
}

export function RadioField({
  label,
  name,
  value,
  onChange,
  required = false,
  options,
  inline = false,
  className = '',
  disabled = false
}: RadioFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className={inline ? 'flex gap-6' : 'space-y-3'}>
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(name, opt.value)}
              required={required}
              disabled={disabled}
              className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">{opt.label}</div>
              {opt.description && (
                <div className="text-sm text-gray-600">{opt.description}</div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// Textarea
interface TextareaFieldProps extends BaseFieldProps {
  placeholder?: string;
  rows?: number;
}

export function TextareaField({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder,
  rows = 3,
  className = '',
  disabled = false
}: TextareaFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

// SSN Input (formatted as XXX-XX-XXXX)
interface SSNFieldProps extends BaseFieldProps {
  placeholder?: string;
}

export function SSNField({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder = 'XXX-XX-XXXX',
  className = '',
  disabled = false
}: SSNFieldProps) {
  const formatSSN = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange(name, rawValue.slice(0, 9));
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value ? formatSSN(value) : ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        maxLength={11}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}
