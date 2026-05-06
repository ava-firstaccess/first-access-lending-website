import { NextRequest, NextResponse } from 'next/server';
import { getLoanProcessorPortalHost } from '@/lib/lo-portal-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const ORDERS_TABLE = 'clear_capital_pci_orders';
const EVENTS_TABLE = 'clear_capital_pci_order_events';

type SnsEnvelope = {
  Type?: string;
  MessageId?: string;
  Message?: string;
  SubscribeURL?: string;
  Timestamp?: string;
  TopicArn?: string;
};

type PciEventPayload = {
  event?: string;
  orderId?: string;
  tenantId?: string;
  timestamp?: string;
  referenceIdentifier?: string;
  estimatedCompletionDate?: string;
  inspectionDate?: string;
  previousInspectionDate?: string;
  reason?: string;
  message?: string;
  isUrgent?: boolean;
  fee?: number;
  exportUrl?: string;
  deliverables?: unknown[];
  [key: string]: unknown;
};

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function asIsoOrNull(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeEventStatus(eventType: string) {
  switch (eventType) {
    case 'OrderAccepted': return 'accepted';
    case 'OrderDeclined': return 'declined';
    case 'OrderAssigned': return 'assigned';
    case 'OrderCompleted': return 'completed';
    case 'OrderCanceled': return 'canceled';
    case 'InspectionScheduled': return 'inspection_scheduled';
    case 'InspectionCompleted': return 'inspection_completed';
    case 'HoldAdded': return 'hold_added';
    case 'HoldRemoved': return 'hold_removed';
    case 'MessageAdded': return 'message_added';
    case 'EstimatedCompletionDateChanged': return 'eta_changed';
    case 'RevisionRequestDenied': return 'revision_denied';
    case 'UnderReview': return 'under_review';
    default: return eventType.toLowerCase() || 'updated';
  }
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml({
  address,
  orderId,
  eventType,
  status,
  reason,
  message,
  estimatedCompletionDate,
  inspectionDate,
}: {
  address?: string | null;
  orderId: string;
  eventType: string;
  status: string;
  reason?: string | null;
  message?: string | null;
  estimatedCompletionDate?: string | null;
  inspectionDate?: string | null;
}) {
  const portalUrl = `https://${getLoanProcessorPortalHost()}/processor`;
  const prettyStatus = status.replace(/_/g, ' ');

  return `
    <div style="margin:0;padding:24px;background:#f8fbff;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(2,131,219,0.08);">
        <div style="padding:20px 24px;background:linear-gradient(135deg,#003961 0%,#0283DB 72%,#0EF0F0 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;opacity:0.9;">Loan Processor PCI</div>
          <div style="margin-top:8px;font-size:28px;line-height:1.2;font-weight:700;">Clear Capital status updated</div>
          <div style="margin-top:8px;font-size:14px;opacity:0.9;">First Access Lending</div>
        </div>
        <div style="padding:24px;line-height:1.6;font-size:15px;">
          <p style="margin:0 0 12px;">Clear Capital sent a new PCI update${address ? ` for <strong>${escapeHtml(address)}</strong>` : ''}.</p>
          <p style="margin:0 0 16px;">Order ID: <strong>${escapeHtml(orderId)}</strong></p>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 20px;">
            <div style="padding:14px 16px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
              <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#475569;font-weight:700;">Event</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;color:#003961;">${escapeHtml(eventType)}</div>
            </div>
            <div style="padding:14px 16px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
              <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#475569;font-weight:700;">Status</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;color:#003961;text-transform:capitalize;">${escapeHtml(prettyStatus)}</div>
            </div>
          </div>
          ${estimatedCompletionDate ? `<p style="margin:0 0 10px;"><strong>Estimated completion:</strong> ${escapeHtml(new Date(estimatedCompletionDate).toLocaleString())}</p>` : ''}
          ${inspectionDate ? `<p style="margin:0 0 10px;"><strong>Inspection date:</strong> ${escapeHtml(new Date(inspectionDate).toLocaleString())}</p>` : ''}
          ${reason ? `<p style="margin:0 0 10px;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
          ${message ? `<p style="margin:0 0 20px;"><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
          <p style="margin:0 0 20px;"><a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#0283DB;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Open PCI orders table</a></p>
          <p style="margin:0;color:#475569;font-size:12px;">This alert was generated from the loan processor portal webhook receiver.</p>
        </div>
      </div>
    </div>
  `;
}

async function sendStatusEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'First Access Lending <info@firstaccesslending.com>',
      to: [to],
      subject,
      html,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`PCI status email failed (${response.status})`);
  }
}

function isAllowedSubscribeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('amazonaws.com');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const envelope = parseJson<SnsEnvelope>(raw) || {};
  const snsType = req.headers.get('x-amz-sns-message-type') || envelope.Type || '';
  const supabase = getSupabaseAdmin();

  try {
    if (snsType === 'SubscriptionConfirmation') {
      const subscribeUrl = String(envelope.SubscribeURL || '').trim();
      let confirmed = false;
      if (subscribeUrl && isAllowedSubscribeUrl(subscribeUrl) && process.env.CLEARCAPITAL_PCI_AUTO_CONFIRM_WEBHOOK !== 'false') {
        const confirmationResponse = await fetch(subscribeUrl, { method: 'GET', cache: 'no-store' });
        confirmed = confirmationResponse.ok;
      }

      await supabase.from(EVENTS_TABLE).upsert({
        event_type: 'SubscriptionConfirmation',
        dedupe_key: `${envelope.MessageId || 'sns'}:SubscriptionConfirmation`,
        sns_message_id: envelope.MessageId || null,
        sns_type: snsType,
        payload: envelope,
      }, { onConflict: 'dedupe_key' });

      return NextResponse.json({ ok: true, confirmed });
    }

    if (snsType === 'UnsubscribeConfirmation') {
      await supabase.from(EVENTS_TABLE).upsert({
        event_type: 'UnsubscribeConfirmation',
        dedupe_key: `${envelope.MessageId || 'sns'}:UnsubscribeConfirmation`,
        sns_message_id: envelope.MessageId || null,
        sns_type: snsType,
        payload: envelope,
      }, { onConflict: 'dedupe_key' });

      return NextResponse.json({ ok: true });
    }

    const message = (typeof envelope.Message === 'string' ? parseJson<PciEventPayload>(envelope.Message) : null) || parseJson<PciEventPayload>(raw) || {};
    const eventType = String(message.event || snsType || 'UnknownEvent').trim();
    const orderId = String(message.orderId || '').trim();
    const eventTimestamp = asIsoOrNull(message.timestamp) || asIsoOrNull(envelope.Timestamp) || new Date().toISOString();
    const dedupeKey = `${envelope.MessageId || orderId || 'unknown'}:${eventType}:${eventTimestamp}`;

    const insertEvent = await supabase.from(EVENTS_TABLE).insert({
      order_id: orderId || null,
      event_type: eventType,
      event_timestamp: eventTimestamp,
      dedupe_key: dedupeKey,
      sns_message_id: envelope.MessageId || null,
      sns_type: snsType || null,
      payload: { envelope, message },
    }).select('id').single();

    if (insertEvent.error) {
      if (insertEvent.error.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw insertEvent.error;
    }

    const status = normalizeEventStatus(eventType);
    const upsertPayload: Record<string, unknown> = {
      order_id: orderId,
      reference_identifier: String(message.referenceIdentifier || '').trim() || null,
      tenant_id: String(message.tenantId || '').trim() || null,
      status,
      hold_reason: eventType === 'HoldAdded' || eventType === 'RevisionRequestDenied' || eventType === 'OrderCanceled' || eventType === 'OrderDeclined'
        ? String(message.reason || '').trim() || null
        : undefined,
      last_message: eventType === 'MessageAdded' ? String(message.message || '').trim() || null : undefined,
      last_message_urgent: eventType === 'MessageAdded' ? Boolean(message.isUrgent) : undefined,
      inspection_date: eventType === 'InspectionScheduled' ? asIsoOrNull(message.inspectionDate) : undefined,
      estimated_completion_date: eventType === 'EstimatedCompletionDateChanged' ? asIsoOrNull(message.estimatedCompletionDate) : undefined,
      fee_amount: typeof message.fee === 'number' ? message.fee : undefined,
      export_url: typeof message.exportUrl === 'string' ? message.exportUrl : eventType === 'OrderCompleted' ? String(message.exportUrl || '') || null : undefined,
      deliverables: Array.isArray(message.deliverables) ? message.deliverables : undefined,
      last_event_type: eventType,
      last_event_at: eventTimestamp,
      latest_event_payload: message,
      updated_at: new Date().toISOString(),
    };

    Object.keys(upsertPayload).forEach((key) => {
      if (upsertPayload[key] === undefined) delete upsertPayload[key];
    });

    const { error: upsertError } = await supabase.from(ORDERS_TABLE).upsert(upsertPayload, { onConflict: 'order_id' });
    if (upsertError) throw upsertError;

    const { data: orderRow } = await supabase
      .from(ORDERS_TABLE)
      .select('order_id,address,ordered_by_email,status,estimated_completion_date,inspection_date,hold_reason,last_message')
      .eq('order_id', orderId)
      .maybeSingle();

    const orderedByEmail = String(orderRow?.ordered_by_email || process.env.CLEARCAPITAL_PCI_ALERT_EMAIL || '').trim();
    if (orderedByEmail) {
      try {
        await sendStatusEmail(
          orderedByEmail,
          `PCI status updated: ${eventType}${orderRow?.address ? ` for ${orderRow.address}` : ''}`,
          buildEmailHtml({
            address: orderRow?.address || null,
            orderId,
            eventType,
            status: String(orderRow?.status || status),
            reason: (orderRow?.hold_reason as string | null | undefined) || String(message.reason || '') || null,
            message: (orderRow?.last_message as string | null | undefined) || String(message.message || '') || null,
            estimatedCompletionDate: (orderRow?.estimated_completion_date as string | null | undefined) || asIsoOrNull(message.estimatedCompletionDate),
            inspectionDate: (orderRow?.inspection_date as string | null | undefined) || asIsoOrNull(message.inspectionDate),
          })
        );
      } catch (emailError) {
        console.error('PCI status email failed:', emailError);
      }
    }

    return NextResponse.json({ ok: true, eventType, orderId });
  } catch (error) {
    console.error('Clear Capital PCI webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
