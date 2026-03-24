// Reusable Question Card Component
'use client';

import { ReactNode } from 'react';

interface QuestionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onContinue?: () => void;
  showContinue?: boolean;
  isValid?: boolean;
  progress?: number; // 0-100
}

export default function QuestionCard({
  title,
  subtitle,
  children,
  onContinue,
  showContinue = true,
  isValid = true,
  progress = 0
}: QuestionCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      
      {/* Progress Bar */}
      {progress > 0 && (
        <div className="mb-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-blue-700 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-right">{Math.round(progress)}% complete</p>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
        
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-600">{subtitle}</p>
          )}
        </div>

        {/* Content */}
        <div className="mb-8">
          {children}
        </div>

        {/* Actions */}
        {showContinue && (
          <div className="space-y-4">
            <button
              onClick={onContinue}
              disabled={!isValid}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                isValid
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
            </button>

            {/* Exit Ramp */}
            <div className="text-center pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-2">
                Rather talk to someone?
              </p>
              <a 
                href="tel:1-888-885-7789"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call 1-888-885-7789
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
