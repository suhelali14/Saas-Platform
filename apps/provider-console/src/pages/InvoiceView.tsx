import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface InvoiceResponse {
  invoice: Invoice & { account: { name: string; slug: string } };
  supplier: { name: string; address: string | null; gstin: string | null; state: string; stateName: string | null; email: string | null; phone: string | null };
  placeOfSupplyName: string | null;
}

const rs = (v: string | number) => `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/**
 * A GST tax invoice, as it prints.
 *
 * White paper and black ink regardless of the console's dark theme,
 * because this is the one screen that becomes a document. It carries what
 * a tax invoice must: supplier and recipient with GSTINs, a serial number,
 * the date, place of supply, SAC per line, taxable value, the tax split,
 * and the total. Printing uses the browser ("Save as PDF").
 */
export function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<InvoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<InvoiceResponse>(`/invoices/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the invoice."));
  }, [id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { invoice: inv, supplier } = data;
  const intra = Number(inv.igst) === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link to={`/clinics/${inv.accountId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {inv.account.name}
        </Link>
        <Button onClick={() => window.print()}><Printer className="size-4" /> Print or save as PDF</Button>
      </div>

      <article className="invoice-sheet mx-auto max-w-[800px] rounded-md bg-white p-10 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-5">
          <div>
            <p className="text-lg font-bold">{supplier.name}</p>
            {supplier.address && <p className="whitespace-pre-line text-neutral-700">{supplier.address}</p>}
            {supplier.gstin && <p>GSTIN: <span className="font-mono">{supplier.gstin}</span></p>}
            <p>State: {supplier.stateName ?? supplier.state} ({supplier.state})</p>
            {(supplier.email || supplier.phone) && <p className="text-neutral-700">{[supplier.email, supplier.phone].filter(Boolean).join(" · ")}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-wide">{inv.status === "DRAFT" ? "DRAFT — NOT AN INVOICE" : "TAX INVOICE"}</p>
            <p>No. <span className="font-mono">{inv.number ?? "—"}</span></p>
            <p>Date: {date(inv.issuedAt)}</p>
            {inv.dueAt && <p>Due: {date(inv.dueAt)}</p>}
            {inv.status === "VOID" && <p className="font-bold text-red-700">VOID</p>}
            {inv.status === "PAID" && <p className="font-semibold text-green-800">Paid {date(inv.paidAt)}</p>}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b border-neutral-300 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Billed to</p>
            <p className="font-semibold">{inv.billingName ?? inv.account.name}</p>
            {inv.billingAddress && <p className="whitespace-pre-line text-neutral-700">{inv.billingAddress}</p>}
            {inv.gstin ? <p>GSTIN: <span className="font-mono">{inv.gstin}</span></p> : <p className="text-neutral-600">Unregistered</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Place of supply</p>
            <p>{data.placeOfSupplyName ?? inv.placeOfSupply} ({inv.placeOfSupply})</p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Plan</p>
            <p>{inv.planLabel}</p>
          </div>
        </section>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-600">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Description</th>
              <th className="py-2 pr-2 font-semibold">SAC</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200 align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 pr-2 font-mono">{l.sac}</td>
                <td className="py-2 text-right tabular-nums">{rs(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-72 space-y-1 tabular-nums">
          <p className="flex justify-between"><span>Taxable value</span><span>{rs(inv.subtotal)}</span></p>
          {intra ? (
            <>
              <p className="flex justify-between"><span>CGST 9%</span><span>{rs(inv.cgst)}</span></p>
              <p className="flex justify-between"><span>SGST 9%</span><span>{rs(inv.sgst)}</span></p>
            </>
          ) : (
            <p className="flex justify-between"><span>IGST 18%</span><span>{rs(inv.igst)}</span></p>
          )}
          <p className="flex justify-between border-t border-neutral-400 pt-1.5 text-[15px] font-bold"><span>Total</span><span>{rs(inv.total)}</span></p>
        </div>

        {inv.notes && <p className="mt-6 whitespace-pre-line text-neutral-700">{inv.notes}</p>}
        {inv.paymentRef && <p className="mt-2 text-neutral-700">Payment: {inv.paymentMode} · {inv.paymentRef}</p>}

        <footer className="mt-10 flex items-end justify-between border-t border-neutral-300 pt-5 text-[11px] text-neutral-600">
          <p>This is a computer-generated invoice.</p>
          <p className="text-right">For {supplier.name}<br /><br />Authorised signatory</p>
        </footer>
      </article>
    </div>
  );
}
