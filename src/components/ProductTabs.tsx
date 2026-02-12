'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface ProductData {
  id: string;
  label: string;
  href: string;
  title: string;
  description: string;
  features: {
    title: string;
    detail: string;
  }[];
}

const productData: ProductData[] = [
  {
    id: 'heloc',
    label: 'HELOC',
    href: '/heloc',
    title: 'Home Equity Line of Credit',
    description: 'We specialize in accessing your home equity while keeping your low first mortgage rate. Draw what you need, when you need it, perfect for ongoing projects, emergencies, or opportunities.',
    features: [
      { title: 'Keep your first mortgage rate', detail: 'Don\'t lose your low rate' },
      { title: 'No appraisal required', detail: 'Fast, streamlined process' },
      { title: 'Loans up to $850K', detail: 'Access substantial equity for major projects' },
      { title: 'CLTV up to 80%', detail: 'Maximum combined loan-to-value' },
      { title: 'Primary, Vacation, Investment', detail: 'All property types accepted' },
      { title: '1-4 units', detail: 'Single family to small multifamily' }
    ]
  },
  {
    id: 'second-mortgages',
    label: 'Second Mortgages',
    href: '/second-mortgages',
    title: 'Second Mortgage (Closed-End Second Lien)',
    description: 'We specialize in accessing your home equity with a fixed-rate lump sum while keeping your existing first mortgage. Predictable monthly payments, no surprises, perfect when you know exactly how much you need.',
    features: [
      { title: 'Keep your first mortgage rate', detail: 'Don\'t lose your low rate' },
      { title: 'No appraisal required', detail: 'Fast, streamlined process' },
      { title: 'Loans up to $850K', detail: 'Access significant equity' },
      { title: 'CLTV up to 90%', detail: 'Higher loan amounts available' },
      { title: 'Primary, Vacation, Investment', detail: 'All property types accepted' },
      { title: '1-4 units', detail: 'Single family to small multifamily' }
    ]
  },
  {
    id: 'dscr',
    label: 'DSCR',
    href: '/dscr',
    title: 'DSCR Loans (Debt Service Coverage Ratio)',
    description: 'We specialize in accessing your next investment property based on cash flow, not personal income. Perfect for real estate investors who want to scale their portfolio without traditional income verification.',
    features: [
      { title: 'No income verification', detail: 'Qualify based on rental income' },
      { title: '1st and 2nd lien options', detail: 'Flexible financing structures' },
      { title: 'DSCR as low as 0.75', detail: 'Cash flow-based underwriting' },
      { title: 'Up to 10 units', detail: 'Large multifamily properties' },
      { title: 'Mixed use properties', detail: 'Commercial and residential combined' },
      { title: 'Fast closings', detail: 'Less documentation required' }
    ]
  },
  {
    id: 'refinance',
    label: 'Refinance',
    href: '/refinance',
    title: 'Rate & Term or Cash-Out Refinance',
    description: 'We specialize in accessing a lower rate or unlocking equity by replacing your existing mortgage. Great when rates are favorable or you want to consolidate debt into a single payment.',
    features: [
      { title: 'Rate & term refinance', detail: 'Lower your rate and payment' },
      { title: 'Cash-out refinance', detail: 'Access equity for any purpose' },
      { title: 'Replace your mortgage', detail: 'New first lien with better terms' },
      { title: 'Consolidate debt', detail: 'Combine multiple loans into one' }
    ]
  },
  {
    id: 'home-purchase',
    label: 'Home Purchase',
    href: '/home-purchase',
    title: 'Home Purchase Financing',
    description: 'We specialize in accessing your next home or dream property. Whether it\'s your primary residence, vacation home, or investment property, we\'ve got you covered with flexible financing options.',
    features: [
      { title: 'Primary residences', detail: 'Financing for your home' },
      { title: 'Vacation homes', detail: 'Second homes and getaways' },
      { title: 'Investment properties', detail: 'Build your portfolio' },
      { title: 'NonQM programs', detail: 'Alternative income documentation' },
      { title: 'DSCR loans', detail: 'Investor cash flow financing' },
      { title: 'Fast approvals', detail: 'Streamlined closing process' }
    ]
  }
];

interface ProductTabsProps {
  currentProduct?: string;
}

export default function ProductTabs({ currentProduct }: ProductTabsProps) {
  const pathname = usePathname();
  
  // Determine the landing page product from pathname or prop
  let landingProduct = currentProduct;
  if (!landingProduct) {
    if (pathname === '/heloc') landingProduct = 'heloc';
    else if (pathname === '/second-mortgages') landingProduct = 'second-mortgages';
    else if (pathname === '/dscr') landingProduct = 'dscr';
    else if (pathname === '/refinance') landingProduct = 'refinance';
    else if (pathname === '/home-purchase') landingProduct = 'home-purchase';
  }

  // Active tab state - starts with the landing product or first tab
  const [activeTab, setActiveTab] = useState(landingProduct || productData[0].id);

  // Get active product data
  const activeProduct = productData.find(p => p.id === activeTab) || productData[0];

  // Reorder tabs: current landing product first, then others in original order
  const orderedTabs = landingProduct
    ? [
        ...productData.filter(p => p.id === landingProduct),
        ...productData.filter(p => p.id !== landingProduct)
      ]
    : productData;

  return (
    <section className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        {/* Tab Navigation - Reordered to show landing product first */}
        <div className="flex gap-1 mb-8 border-b border-gray-200 overflow-x-auto">
          {orderedTabs.map((product) => (
            <button
              key={product.id}
              onClick={() => setActiveTab(product.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                product.id === activeTab
                  ? 'text-[#003961] border-[#0EF0F0]'
                  : 'text-gray-600 border-transparent hover:text-[#003961] hover:border-gray-300'
              }`}
            >
              {product.label}
            </button>
          ))}
        </div>

        {/* Tab Content - Changes based on active tab */}
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-heading text-3xl font-bold text-[#003961] mb-6">{activeProduct.title}</h2>
            <p className="text-lg text-gray-700 mb-8 leading-relaxed">
              {activeProduct.description}
            </p>
            <Link
              href={activeProduct.href}
              className="inline-block bg-gradient-to-r from-[#0EF0F0] to-[#0283DB] text-[#003961] font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all"
            >
              Get Access →
            </Link>
          </div>

          <div className="bg-gradient-to-br from-[#FAFAFA] to-gray-100 rounded-xl p-8">
            <h3 className="font-heading text-2xl font-bold text-[#003961] mb-6">Key Features</h3>
            <ul className="space-y-4">
              {activeProduct.features.map((feature, idx) => (
                <li key={idx} className="flex items-start text-gray-700">
                  <svg className="w-5 h-5 text-[#0EF0F0] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong className="text-[#003961]">{feature.title}</strong>
                    <p className="text-sm text-gray-600 mt-1">{feature.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
