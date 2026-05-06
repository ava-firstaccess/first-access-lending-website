import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { ProcessorAvmToolsPage } from '@/components/ProcessorAvmToolsPage';
import { getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type PciOrderRow = {
  orderId: string;
  referenceIdentifier: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  orderedByEmail: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  estimatedCompletionDate: string | null;
  inspectionDate: string | null;
  holdReason: string | null;
  lastMessage: string | null;
  lastMessageUrgent: boolean;
  exportUrl: string | null;
  updatedAt: string | null;
};

async function loadPciOrders(): Promise<PciOrderRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('clear_capital_pci_orders')
      .select('order_id,reference_identifier,status,address,city,state,zip,ordered_by_email,last_event_type,last_event_at,estimated_completion_date,inspection_date,hold_reason,last_message,last_message_urgent,export_url,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      if (error.code !== '42P01') {
        console.error('Failed to load PCI orders:', error);
      }
      return [];
    }

    return (data || []).map((row) => ({
      orderId: String(row.order_id),
      referenceIdentifier: row.reference_identifier || null,
      status: row.status || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      zip: row.zip || null,
      orderedByEmail: row.ordered_by_email || null,
      lastEventType: row.last_event_type || null,
      lastEventAt: row.last_event_at || null,
      estimatedCompletionDate: row.estimated_completion_date || null,
      inspectionDate: row.inspection_date || null,
      holdReason: row.hold_reason || null,
      lastMessage: row.last_message || null,
      lastMessageUrgent: Boolean(row.last_message_urgent),
      exportUrl: row.export_url || null,
      updatedAt: row.updated_at || null,
    }));
  } catch (error) {
    console.error('Failed to load PCI orders:', error);
    return [];
  }
}

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const portalRole = resolvePortalRoleFromHost(host);

  if (portalRole !== 'loan_processor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Loan Processor workspace</h1>
          <p className="mt-3 text-sm text-slate-600">This route is reserved for loan processor accounts on lp.firstaccesslending.com.</p>
        </div>
      </div>
    );
  }

  const session = await getLoanOfficerPortalSession();
  if (!session) {
    if (await hasTrustedLoanOfficerBrowser()) {
      redirect('/api/lo-auth/bootstrap-session?next=%2Fprocessor');
    }
    return <LoanOfficerPortalGate nextPath="/processor" title="Loan Processor Portal" subtitle="Login with your email prefix, then verify the code sent to your work email to access AVM tools." />;
  }

  if (session.position !== portalRole) {
    redirect('/api/lo-auth/bootstrap-session?next=%2Fprocessor');
  }

  if (session.position !== 'loan_processor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Processor access required</h1>
          <p className="mt-3 text-sm text-slate-600">This AVM tools workspace is only enabled for users whose <span className="font-semibold">position</span> is <span className="font-semibold">loan_processor</span>.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/pricer" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Open pricer</Link>
          </div>
        </div>
      </div>
    );
  }

  const pciOrders = await loadPciOrders();

  return <ProcessorAvmToolsPage session={{ email: session.email, name: session.name }} initialPciOrders={pciOrders} />;
}
