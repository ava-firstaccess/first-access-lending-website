// Phone Verification - OTP flow before Stage 2
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  // Strip leading country code (1) if 11 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function VerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneMask, setPhoneMask] = useState('');
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const codeRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Auto-focus first code input when switching to code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeRefs[0].current?.focus(), 100);
    }
  }, [step]);

  const phoneDigits = phone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length === 10;

  const handleSendOTP = async () => {
    if (!isPhoneValid) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send code');
        setLoading(false);
        return;
      }

      setPhoneMask(data.phoneMask || '');
      setStep('code');
      setCode(['', '', '', '']);
      setResendTimer(30);
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs[index - 1].current?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const newCode = pasted.split('');
      setCode(newCode);
      codeRefs[3].current?.focus();
      handleVerifyOTP(pasted);
    }
  };

  async function handleVerifyOTP(codeStr: string) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, code: codeStr })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code');
        setCode(['', '', '', '']);
        codeRefs[0].current?.focus();
        setLoading(false);
        return;
      }

      // Success - fetch prefill data, store in localStorage, redirect to Stage 1
      try {
        const prefillRes = await fetch('/api/auth/prefill');
        if (prefillRes.ok) {
          const prefillData = await prefillRes.json();
          if (prefillData.found) {
            if (prefillData.stage1Fields && Object.keys(prefillData.stage1Fields).length > 0) {
              localStorage.setItem('stage1Prefill', JSON.stringify(prefillData.stage1Fields));
            }
            if (prefillData.stage2Fields && Object.keys(prefillData.stage2Fields).length > 0) {
              localStorage.setItem('stage2Prefill', JSON.stringify(prefillData.stage2Fields));
            }
          }
        }
      } catch (prefillErr) {
        console.error('Prefill fetch failed (non-blocking):', prefillErr);
      }

      // If we have Stage 1 data, start there so they review/confirm the quote
      const hasStage1 = localStorage.getItem('stage1Prefill');
      if (hasStage1) {
        router.push('/quote/start?prefilled=1');
      } else {
        router.push('/quote/next-steps');
      }

    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  const handleCodeInput = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    if (digit && index < 3) {
      codeRefs[index + 1].current?.focus();
    }

    if (digit && index === 3 && newCode.every(d => d !== '')) {
      handleVerifyOTP(newCode.join(''));
    }
  }, [code, codeRefs]);

  const handleResend = async () => {
    if (resendTimer > 0) return;
    await handleSendOTP();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Back link */}
        <button
          onClick={() => step === 'code' ? setStep('phone') : router.push('/quote/results')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {step === 'code' ? 'Change number' : 'Back to results'}
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">

          {/* ── Phone Entry ── */}
          {step === 'phone' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Verify Your Phone
                </h1>
                <p className="text-gray-600">
                  We&apos;ll text you a code to secure your application.
                  <br />
                  <span className="text-sm text-gray-500">No spam, no sales calls.</span>
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
                    autoFocus
                    className="w-full text-center text-2xl md:text-3xl font-semibold tracking-wider px-6 py-5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 placeholder:font-normal"
                    onKeyDown={(e) => e.key === 'Enter' && isPhoneValid && handleSendOTP()}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSendOTP}
                  disabled={!isPhoneValid || loading}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                    isPhoneValid && !loading
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Verification Code'
                  )}
                </button>

                <p className="text-xs text-gray-400 mt-4 text-center leading-relaxed">
                  This verification is only to confirm your identity. Entering your number here will <span className="font-medium text-gray-500">not</span> opt you in to marketing calls or texts. If you previously opted in to receive communications from us, we may still reach out separately.
                </p>
                <p className="text-xs text-gray-400 mt-2 text-center leading-relaxed">
                  By clicking &ldquo;Send Verification Code,&rdquo; you consent to receive a one-time automated text message with your verification code. Message and data rates may apply. One message per request. Reply STOP to cancel. View our{' '}
                  <a href="https://eastcoastcap.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Privacy Policy</a> and{' '}
                  <a href="/terms" className="underline hover:text-gray-500">Terms of Service</a>.
                </p>
              </div>
            </>
          )}

          {/* ── Code Entry ── */}
          {step === 'code' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Enter Your Code
                </h1>
                <p className="text-gray-600">
                  We sent a 4-digit code to {phoneMask || phone}
                </p>
              </div>

              <div className="space-y-6">
                {/* Hidden input for iOS OTP autofill */}
                <input
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={4}
                  className="absolute opacity-0 h-0 w-0 pointer-events-none"
                  tabIndex={-1}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (digits.length === 4) {
                      const newCode = digits.split('');
                      setCode(newCode);
                      codeRefs[3].current?.focus();
                      handleVerifyOTP(digits);
                    }
                  }}
                />

                {/* Large code input boxes */}
                <div className="flex justify-center gap-4">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={codeRefs[i]}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={i === 0 ? 4 : 1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        // iOS autofill may put all 4 digits in first box
                        if (val.length >= 4 && i === 0) {
                          const digits = val.slice(0, 4).split('');
                          setCode(digits);
                          codeRefs[3].current?.focus();
                          handleVerifyOTP(digits.join(''));
                        } else {
                          handleCodeInput(i, e.target.value);
                        }
                      }}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      onPaste={i === 0 ? handleCodePaste : undefined}
                      className="w-16 h-20 md:w-20 md:h-24 text-center text-3xl md:text-4xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                    {error}
                  </div>
                )}

                {loading && (
                  <div className="text-center text-blue-600 font-medium">
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying...
                    </span>
                  </div>
                )}

                {/* Resend */}
                <div className="text-center pt-4">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend code in {resendTimer}s
                    </p>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={loading}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Didn&apos;t receive it? Send again
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Trust signals */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Encrypted
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                No spam
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                NMLS Licensed
              </span>
            </div>
          </div>

        </div>

        {/* Phone help */}
        <div className="text-center mt-6">
          <a href="tel:1-888-885-7789" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Need help? Call 1-888-885-7789
          </a>
        </div>

      </div>
    </div>
  );
}
