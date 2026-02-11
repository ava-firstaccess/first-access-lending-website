'use client';

import { useEffect } from 'react';

export default function GoogleReviewsWidget() {
  useEffect(() => {
    // Cleanup function to remove any existing script if component remounts
    return () => {
      const existingScript = document.querySelector('script[src*="jotform.com/website-widgets"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <section className="bg-gradient-to-r from-[#0283DB] to-[#003961] py-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Jotform Widget Container - Widget has its own header */}
        <div id="JFWebsiteWidget-019c4ed34bb07841a17ce4dfe6c1f9fe9b5d"></div>
        <script src='https://www.jotform.com/website-widgets/embed/019c4ed34bb07841a17ce4dfe6c1f9fe9b5d'></script>
      </div>
    </section>
  );
}
