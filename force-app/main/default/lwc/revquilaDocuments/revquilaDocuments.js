import LOGO from "@salesforce/resourceUrl/revquilaLogo";
import saveSnapshot from "@salesforce/apex/RevquilaDocumentController.saveSnapshot";
import { DEFAULT_CONFIG, getConfig } from "c/revquilaConfig";
import { NAMESPACE } from "c/revquilaNav";
import { formatDocumentMoney } from "c/revquilaTax";

/**
 * Turns a quote or an invoice into the page that gets printed.
 *
 * A document (getQuoteDocument / getInvoiceDocument / getOrderDocument in c/revquilaData):
 *   { kind: "quote" | "invoice" | "order", number, version, issuedOn, dueLabel, dueOn, status, isDraft,
 *     reference, paymentTerms, notes, money (the market it is priced in: currency, locale, tax),
 *     customer: { name, contact, addressLines, registrationNumber, region },
 *     lines: [{ name, unit, qty, price, discount, net }],
 *     subtotal, discountTotal, net, tax, total, taxLines: [{ label, rate, amount }],
 *     amountPaid, balance }
 *
 * buildPrintModel(document, config?) lays it out with the admin's PDF settings (Setup > Documents & PDF).
 * The on-screen preview (c-revquila-document-preview) and the real PDF (the RevquilaDocument
 * Visualforce page) both draw that one model, so they cannot disagree about what is printed.
 * Every value in it is already a display string.
 *
 * createPdf(document, config?) stores the model and resolves with the URL of its PDF.
 */

const HEX = /^#[0-9a-f]{6}$/i;
const LAYOUTS = ["classic", "modern", "minimal"];

function hexOr(value, fallback) {
  return HEX.test(value) ? value.toLowerCase() : fallback;
}

// The accent mixed towards white, for fills that sit behind text
function tint(hex, share) {
  return `#${[1, 3, 5]
    .map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16);
      return Math.round(channel + (255 - channel) * share)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

function present(lines) {
  return lines.filter((line) => line && line.trim());
}

function splitLines(text) {
  return present((text || "").split("\n"));
}

function totalRows(doc, tax, pdf, plain) {
  const rows = [];
  if (doc.discountTotal) {
    rows.push(
      { label: "Subtotal", value: plain(doc.subtotal) },
      { label: "Discount", value: `- ${plain(doc.discountTotal)}` }
    );
  }
  if (tax.mode === "none") {
    return rows;
  }
  rows.push({
    label: tax.pricesIncludeTax ? "Net of tax" : "Taxable value",
    value: plain(doc.net)
  });
  if (pdf.showTaxBreakup) {
    doc.taxLines.forEach((line) =>
      rows.push({ label: line.label, value: plain(line.amount) })
    );
  } else {
    rows.push({ label: tax.system, value: plain(doc.tax) });
  }
  return rows;
}

export function buildPrintModel(doc, config = getConfig()) {
  const { company, brand, pdf } = config;
  // the document is in the currency and tax of its own market; the company's own is the home one
  const tax = doc.money || config.tax;
  const invoice = doc.kind === "invoice";
  const order = doc.kind === "order";
  const plain = (amount) =>
    new Intl.NumberFormat(tax.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  const money = (amount) => formatDocumentMoney(amount, tax);
  const accent = hexOr(
    pdf.accent,
    hexOr(brand.accent, DEFAULT_CONFIG.brand.accent)
  );
  const regional = tax.mode === "split" || tax.mode === "regional";
  const registration = (number, labelled = tax) => {
    return number ? `${labelled.registrationLabel}: ${number}` : "";
  };

  let numberLabel = "Quote no.";
  if (invoice) {
    numberLabel = "Invoice no.";
  } else if (order) {
    numberLabel = "Order no.";
  }
  let title = pdf.quoteTitle;
  if (invoice) {
    title = pdf.invoiceTitle;
  } else if (order) {
    title = "Order Confirmation";
  }
  const meta = [
    {
      label: numberLabel,
      value: doc.version > 1 ? `${doc.number} (v${doc.version})` : doc.number
    },
    { label: "Date", value: doc.issuedOn },
    { label: doc.dueLabel, value: doc.dueOn },
    { label: "Payment terms", value: doc.paymentTerms },
    { label: "Reference", value: doc.reference },
    {
      label: `Place of supply`,
      value: regional ? doc.customer.region : ""
    }
  ].filter((row) => row.value);

  const settled = [];
  if (invoice && doc.amountPaid) {
    settled.push(
      { label: "Paid", value: `- ${plain(doc.amountPaid)}` },
      { label: "Balance due", value: money(doc.balance), strong: true }
    );
  }

  return {
    kind: doc.kind,
    title,
    documentNumber: doc.number,
    layout: LAYOUTS.includes(pdf.layout) ? pdf.layout : LAYOUTS[0],
    font: pdf.font === "serif" ? "serif" : "sans",
    pageSize: pdf.pageSize === "Letter" ? "Letter" : "A4",
    accent,
    accentSoft: tint(accent, 0.88),
    showLogo: Boolean(pdf.showLogo),
    logoUrl: brand.logo || "",
    logoRight: pdf.logoPosition === "right",
    watermark: pdf.draftWatermark && doc.isDraft ? "DRAFT" : "",
    companyName: company.name,
    companyLines: present([
      company.address,
      present([company.city, company.state, company.postalCode]).join(", "),
      present([company.phone, company.email]).join(" | "),
      company.website
    ]),
    companyRegistration: registration(company.registrationNumber, config.tax),
    customerName: doc.customer.name,
    customerLines: present([
      doc.customer.contact,
      ...doc.customer.addressLines
    ]),
    customerRegistration: registration(doc.customer.registrationNumber),
    meta,
    showUnit: Boolean(pdf.showUnit),
    showDiscount: Boolean(pdf.showDiscount) && doc.discountTotal > 0,
    priceHeading: `Price (${tax.currency})`,
    amountHeading: `Amount (${tax.currency})`,
    rows: doc.lines.map((line, index) => ({
      no: String(index + 1),
      name: line.name,
      unit: line.unit || "",
      qty: String(line.qty),
      price: plain(line.price),
      discount: line.discount ? `${line.discount}%` : "",
      amount: plain(line.net)
    })),
    totals: totalRows(doc, tax, pdf, plain),
    totalLabel: tax.pricesIncludeTax ? "Total, tax included" : "Total",
    totalValue: money(doc.total),
    settled,
    notesLines: splitLines(doc.notes),
    termsLines: splitLines(pdf.terms),
    bankLines: pdf.showBankDetails ? splitLines(pdf.bankDetails) : [],
    footer: pdf.footer || "",
    signatory: pdf.showSignature ? pdf.signatory || "Authorised Signatory" : ""
  };
}

/** The logo the preview shows: the uploaded one, or the Revquila logo. */
export function previewLogo(model) {
  if (!model.showLogo) {
    return "";
  }
  return model.logoUrl || LOGO;
}

/** Stores the print model and resolves with the URL that renders it as a PDF. */
export function createPdf(doc, config = getConfig()) {
  const page = `${NAMESPACE ? `${NAMESPACE}__` : ""}RevquilaDocument`;
  return saveSnapshot({
    payload: JSON.stringify(buildPrintModel(doc, config))
  }).then((id) => `/apex/${page}?id=${id}`);
}