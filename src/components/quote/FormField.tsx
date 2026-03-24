// Reusable Form Field Components
'use client';

import { ChangeEvent } from 'react';

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

// Date Input
interface DateFieldProps extends BaseFieldProps {
  min?: string;
  max?: string;
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
  disabled = false
}: DateFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
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
        maxLength={11}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}
