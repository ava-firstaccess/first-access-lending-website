'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface Tab {
  id: string;
  label: string;
  href: string;
}

const allTabs: Tab[] = [
  { id: 'heloc', label: 'HELOC', href: '/heloc' },
  { id: 'second-mortgages', label: 'Second Mortgages', href: '/second-mortgages' },
  { id: 'refinance', label: 'Refinance', href: '/refinance' },
  { id: 'home-purchase', label: 'Home Purchase', href: '/home-purchase' }
];

interface ProductTabsProps {
  currentProduct?: string;
}

export default function ProductTabs({ currentProduct }: ProductTabsProps) {
  const pathname = usePathname();
  
  // Determine active tab from pathname or prop
  let activeTab = currentProduct;
  if (!activeTab) {
    if (pathname === '/heloc') activeTab = 'heloc';
    else if (pathname === '/second-mortgages') activeTab = 'second-mortgages';
    else if (pathname === '/refinance') activeTab = 'refinance';
    else if (pathname === '/home-purchase') activeTab = 'home-purchase';
  }

  // Reorder tabs: current product first, then others
  const orderedTabs = activeTab
    ? [
        ...allTabs.filter(tab => tab.id === activeTab),
        ...allTabs.filter(tab => tab.id !== activeTab)
      ]
    : allTabs;

  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex gap-1 overflow-x-auto">
          {orderedTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                tab.id === activeTab
                  ? 'text-[#003961] border-[#0EF0F0]'
                  : 'text-gray-600 border-transparent hover:text-[#003961] hover:border-gray-300'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
