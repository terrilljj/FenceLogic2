/**
 * Calculator lead delivery — mirrors the storefront's setup (ADR 0050):
 * Resend transactional API + dual-write to bh_storefront.leads (DB is source of truth,
 * email is best-effort). Reuses the same RESEND_API_KEY / CONTACT_EMAIL / RESEND_FROM_EMAIL.
 */
import { spanVariant, type FenceDesign } from "@shared/schema";

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "notifications@barrierhub.com.au";

export type PricedLine = {
  qty: number;
  description: string;
  sku: string;
  unitPrice: number | null;
  totalPrice: number | null;
};

const money = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

/** Send via the Resend HTTP API. Returns true on success; never throws. No key → skip. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[quote-email] RESEND_API_KEY unset — lead saved, email skipped");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[quote-email] Resend error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[quote-email] send failed", e);
    return false;
  }
}

/** Plain-text lead summary for the bh_storefront.leads.message column. */
export function buildLeadMessage(design: FenceDesign, grandTotal: number): string {
  const lines = design.spans.map((s, i) => {
    const v = spanVariant(design, s);
    return `  ${i + 1}. ${s.name?.trim() || `Section ${s.spanId}`} — ${v} · ${s.length}mm`;
  });
  return [
    `Calculator quote: ${design.name || "Fence design"}`,
    `Shape: ${design.shape} · ${design.spans.length} section(s)`,
    ...lines,
    `Estimated total (inc GST): ${money(grandTotal)}`,
  ].join("\n");
}

/** Full priced SKU plan emailed to the customer (CLAUDE.md: deliverable is email-only). */
export function buildQuoteEmailHtml(designName: string, lines: PricedLine[], grandTotal: number): string {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${l.qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(l.description)}<br><span style="color:#888;font-family:monospace;font-size:11px">${esc(l.sku)}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${money(l.unitPrice)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${money(l.totalPrice)}</td>
      </tr>`
    )
    .join("");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2 style="margin:0 0 4px">Your Barrier Hub quote</h2>
    <p style="margin:0 0 16px;color:#666">${esc(designName)} — component list &amp; pricing (inc GST)</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f6f7f8;text-align:left">
        <th style="padding:6px 8px;text-align:center">Qty</th>
        <th style="padding:6px 8px">Item</th>
        <th style="padding:6px 8px;text-align:right">Unit</th>
        <th style="padding:6px 8px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:10px 8px;text-align:right;font-weight:700">Estimated total (inc GST)</td>
        <td style="padding:10px 8px;text-align:right;font-weight:700">${money(grandTotal)}</td>
      </tr></tfoot>
    </table>
    <p style="margin:16px 0 0;color:#888;font-size:12px">Indicative pricing — final quote confirmed by Barrier Hub. Reply to this email to proceed.</p>
  </div>`;
}

/** Short operator notification (to CONTACT_EMAIL). */
export function buildLeadNotifyHtml(email: string, design: FenceDesign, grandTotal: number): string {
  return `<div style="font-family:Arial,sans-serif">
    <p><strong>New calculator lead:</strong> ${esc(email)}</p>
    <pre style="background:#f6f7f8;padding:10px;border-radius:6px;font-size:12px">${esc(buildLeadMessage(design, grandTotal))}</pre>
  </div>`;
}
