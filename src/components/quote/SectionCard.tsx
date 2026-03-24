// Collapsible Section Card with Progress Indicator
'use client';

import { ReactNode, useState } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  isComplete: boolean;
  defaultOpen?: boolean;
  sectionNumber: number;
}

export default function SectionCard({
  title,
  description,
  children,
  isComplete,
  defaultOpen = false,
  sectionNumber
}: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-4">
      
      {/* Header (clickable to expand/collapse) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Section Number / Checkmark */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
            isComplete
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {isComplete ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              sectionNumber
            )}
          </div>

          {/* Title & Description */}
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content (collapsible) */}
      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
          </div>
        </div>
      )}

    </div>
  );
}
