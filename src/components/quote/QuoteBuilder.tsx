// Live Quote Builder Sidebar
'use client';

interface QuoteBuilderProps {
  maxAvailable?: number;
  desiredLoanAmount?: number;
  rateRange?: { min: number; max: number };
  monthlyPayment?: number;
  monthlyPaymentRange?: { min: number; max: number };
  progress: number;
  stage: 'stage1' | 'stage2';
  sticky?: boolean;
  showMaxAvailable?: boolean;
  loading?: boolean;
}

export default function QuoteBuilder({
  maxAvailable,
  desiredLoanAmount,
  rateRange,
  monthlyPayment,
  monthlyPaymentRange,
  progress,
  stage,
  sticky = true,
  showMaxAvailable = true,
  loading = false,
}: QuoteBuilderProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatRate = (rate: number) => {
    return `${rate.toFixed(3)}%`;
  };

  return (
    <div className={`bg-white rounded-2xl shadow-xl p-6 ${sticky ? 'sticky top-6' : ''}`}>
      
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Your Quote</h3>
        <p className="text-sm text-gray-600 mt-1">
          Estimated based on your answers
        </p>
      </div>

      {/* Quote Details */}
      <div className="space-y-6">
        
        {/* Max Available */}
        {showMaxAvailable && (
          <div>
            <label className="text-sm text-gray-600 block mb-1">Max Available</label>
            <div className={`text-3xl font-bold ${maxAvailable ? 'text-gray-900' : 'text-gray-300'}`}>
              {maxAvailable ? formatCurrency(maxAvailable) : '$—'}
            </div>
            {stage === 'stage1' && maxAvailable && (
              <p className="text-xs text-gray-500 mt-1">Updates as you answer</p>
            )}
          </div>
        )}

        {/* Desired Loan Amount */}
        {stage === 'stage2' && (
          <div>
            <label className="text-sm text-gray-600 block mb-1">Desired Loan Amount</label>
            <div className={`text-2xl font-bold ${desiredLoanAmount ? 'text-gray-900' : 'text-gray-300'}`}>
              {desiredLoanAmount ? formatCurrency(desiredLoanAmount) : '$—'}
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-5 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-gray-900">Loading live quote</p>
            <p className="text-xs text-gray-500 mt-1">We&apos;re pulling fresh pricing now.</p>
          </div>
        ) : (
          <>
            {/* Rate Range */}
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                {stage === 'stage1' ? 'Estimated Rate' : 'Your Rate'}
              </label>
              <div className={`text-2xl font-bold ${rateRange ? 'text-gray-900' : 'text-gray-300'}`}>
                {rateRange 
                  ? stage === 'stage1' 
                    ? `${formatRate(rateRange.min)} - ${formatRate(rateRange.max)}`
                    : formatRate(rateRange.min)
                  : '—%'
                }
              </div>
            </div>

            {/* Monthly Payment */}
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                {stage === 'stage1' ? '~Monthly Payment' : 'Monthly Payment'}
              </label>
              <div className={`text-2xl font-bold ${(monthlyPayment || monthlyPaymentRange) ? 'text-gray-900' : 'text-gray-300'}`}>
                {stage === 'stage1' && monthlyPaymentRange
                  ? `${formatCurrency(monthlyPaymentRange.min)} - ${formatCurrency(monthlyPaymentRange.max)}`
                  : monthlyPayment
                    ? formatCurrency(monthlyPayment)
                    : '$—'}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Progress Indicator */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-semibold text-gray-900">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-blue-700 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* CTA (Stage 1 only) */}
      {stage === 'stage1' && progress >= 100 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
            Get Custom Quote
          </button>
          <p className="text-xs text-center text-gray-500 mt-2">
            Continue to full application
          </p>
        </div>
      )}

    </div>
  );
}
