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
    icon: string;
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
    description: 'Keep your low first mortgage rate and access your equity with a HELOC. Draw what you need, when you need it—perfect for ongoing projects, emergencies, or opportunities.',
    features: [
      { icon: '💰', title: 'Loans up to $850K', detail: 'Access substantial equity for major projects' },
      { icon: '🏠', title: 'Multiple property types', detail: 'Primary, vacation, and investment properties' },
      { icon: '🔄', title: 'Revolving credit', detail: 'Borrow, repay, and borrow again during draw period' },
      { icon: '⚡', title: 'No appraisal required', detail: 'Streamlined approval process' }
    ]
  },
  {
    id: 'second-mortgages',
    label: 'Second Mortgages',
    href: '/second-mortgages',
    title: 'Second Mortgage (Closed-End Second Lien)',
    description: 'Get a fixed-rate lump sum while keeping your existing first mortgage. Predictable monthly payments, no surprises—perfect when you know exactly how much you need.',
    features: [
      { icon: '💵', title: 'Fixed-rate lump sum', detail: 'One-time funding with predictable payments' },
      { icon: '🔒', title: 'Keep your first mortgage', detail: 'Don\'t lose your low rate' },
      { icon: '📊', title: 'Up to 90% CLTV', detail: 'Access more of your equity' },
      { icon: '✅', title: 'Simple and predictable', detail: 'Fixed monthly payments' }
    ]
  },
  {
    id: 'refinance',
    label: 'Refinance',
    href: '/refinance',
    title: 'Cash-Out Refinance',
    description: 'Replace your existing first mortgage and pull cash out in one transaction. Great when rates are favorable or you want to consolidate debt into a single payment.',
    features: [
      { icon: '🔄', title: 'Replace your mortgage', detail: 'New first lien with better terms' },
      { icon: '💸', title: 'Access your equity', detail: 'Cash out for any purpose' },
      { icon: '📉', title: 'Lower your rate', detail: 'When market conditions are right' },
      { icon: '🤝', title: 'Consolidate debt', detail: 'Combine multiple loans into one' }
    ]
  },
  {
    id: 'home-purchase',
    label: 'Home Purchase',
    href: '/home-purchase',
    title: 'Home Purchase Financing',
    description: 'Competitive financing for your next property purchase. Whether it\'s your primary residence, vacation home, or investment property—we\'ve got you covered.',
    features: [
      { icon: '🏡', title: 'Primary residences', detail: 'Financing for your home' },
      { icon: '🏖️', title: 'Vacation homes', detail: 'Second homes and getaways' },
      { icon: '📈', title: 'Investment properties', detail: 'Build your portfolio' },
      { icon: '⚡', title: 'Fast approvals', detail: 'Close on time, every time' }
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
                  <div className="text-2xl mr-3 flex-shrink-0">{feature.icon}</div>
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
