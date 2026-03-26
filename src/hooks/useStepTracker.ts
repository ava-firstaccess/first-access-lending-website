'use client';

import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook for real-time Supabase sync on each step/card transition.
 * Generates a persistent anonymousId for pre-auth tracking.
 * Captures referrer and user agent on first call.
 */
export function useStepTracker(stage: 'stage1' | 'stage2') {
  const anonymousIdRef = useRef<string | null>(null);
  const referrerRef = useRef<string | null>(null);

  useEffect(() => {
    // Get or create anonymous ID
    let id = localStorage.getItem('fal_anonymous_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('fal_anonymous_id', id);
    }
    anonymousIdRef.current = id;

    // Capture referrer/UTM on entry
    const params = new URLSearchParams(window.location.search);
    referrerRef.current = params.get('utm_source') || document.referrer || null;
  }, []);

  const trackStep = useCallback(async (
    stepName: string,
    stepNumber: number,
    totalSteps: number,
    formData: Record<string, any>
  ) => {
    try {
      // Strip sensitive fields before sending (SSN, DOB sent only on final submit)
      const safeData = { ...formData };
      delete safeData['Borrower - SSN'];
      delete safeData['Co-Borrower - SSN'];
      // Keep transient UI fields out
      for (const key of Object.keys(safeData)) {
        if (key.startsWith('_')) delete safeData[key];
      }

      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymousId: anonymousIdRef.current,
          formData: safeData,
          currentStep: `${stage}:${stepName}`,
          stepNumber,
          totalSteps,
          referrer: referrerRef.current,
          userAgent: navigator.userAgent,
        }),
      });
      // Fire and forget - don't block UI on tracking failure
    } catch {
      // Silent fail - tracking shouldn't break the form
    }
  }, [stage]);

  return { trackStep };
}
