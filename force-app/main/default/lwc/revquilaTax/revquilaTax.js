import { getConfig } from "c/revquilaConfig";

/**
 * Tax and currency engine behind Setup > Tax & currency.
 *
 * Settings shape: DEFAULT_CONFIG.tax in c/revquilaConfig. Four modes:
 *   none      no tax line
 *   single    one line at `rate`                         (VAT, most GST countries)
 *   split     `splitLabels` share the rate when the customer is in the company's own
 *             region, `crossLabel` carries all of it otherwise   (India: CGST + SGST / IGST)
 *   regional  the customer's region sets the rate        (US sales tax, Canada GST/HST/PST)
 *
 * Exports
 *   getCountries()                         [{ code, name, system, known }] sorted by name, every ISO country
 *   getTaxPreset(code)                     { tax, note, regions, known } starting settings for a country
 *   getRegions(code)                       state / province names, [] when not listed
 *   getCurrencies()                        ISO 4217 codes the browser can format
 *   getMarkets()                           the home market and the others, [{ ...tax, exchangeRate }]
 *   marketOf(country)                      the market for a country code or name; the home one when unknown
 *   calculateTax(amount, place, tax?, homeRegion?)  { net, lines: [{ label, rate, amount }], tax, total }
 *   formatMoney(amount, options?)          "₹3,90,000"        options: { decimals = 0, tax }
 *   formatMoneyCompact(amount, options?)   "₹3.9L", "$1.2M"   options: { tax }
 *   formatDocumentMoney(amount, tax?)      "INR 3,90,000.00"  for printed documents
 *
 * The presets are starting points. Rates change, and reduced rates, exemptions and local
 * surcharges are not modelled, so an admin must confirm them before invoicing.
 */

const ISO_COUNTRIES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

// Countries with one national rate: [tax name, standard rate %, currency, locale, registration label]
const SINGLE_RATE = {
  AE: ["VAT", 5, "AED", "en-AE", "TRN"],
  AR: ["IVA", 21, "ARS", "es-AR", "CUIT"],
  AT: ["VAT", 20, "EUR", "de-AT", "VAT number"],
  AU: ["GST", 10, "AUD", "en-AU", "ABN"],
  BD: ["VAT", 15, "BDT", "en-BD", "BIN"],
  BE: ["VAT", 21, "EUR", "nl-BE", "VAT number"],
  BG: ["VAT", 20, "EUR", "bg-BG", "VAT number"],
  BH: ["VAT", 10, "BHD", "en-BH", "VAT number"],
  CH: ["VAT", 8.1, "CHF", "de-CH", "VAT number"],
  CL: ["IVA", 19, "CLP", "es-CL", "RUT"],
  CN: ["VAT", 13, "CNY", "zh-CN", "Tax ID"],
  CO: ["IVA", 19, "COP", "es-CO", "NIT"],
  CY: ["VAT", 19, "EUR", "el-CY", "VAT number"],
  CZ: ["VAT", 21, "CZK", "cs-CZ", "VAT number"],
  DE: ["VAT", 19, "EUR", "de-DE", "VAT number"],
  DK: ["VAT", 25, "DKK", "da-DK", "VAT number"],
  EE: ["VAT", 24, "EUR", "et-EE", "VAT number"],
  EG: ["VAT", 14, "EGP", "en-EG", "Tax ID"],
  ES: ["IVA", 21, "EUR", "es-ES", "NIF"],
  FI: ["VAT", 25.5, "EUR", "fi-FI", "VAT number"],
  FR: ["TVA", 20, "EUR", "fr-FR", "VAT number"],
  GB: ["VAT", 20, "GBP", "en-GB", "VAT number"],
  GR: ["VAT", 24, "EUR", "el-GR", "VAT number"],
  HR: ["VAT", 25, "EUR", "hr-HR", "VAT number"],
  HU: ["VAT", 27, "HUF", "hu-HU", "VAT number"],
  ID: ["PPN", 11, "IDR", "id-ID", "NPWP"],
  IE: ["VAT", 23, "EUR", "en-IE", "VAT number"],
  IL: ["VAT", 18, "ILS", "he-IL", "VAT number"],
  IS: ["VAT", 24, "ISK", "is-IS", "VAT number"],
  IT: ["IVA", 22, "EUR", "it-IT", "Partita IVA"],
  JP: ["Consumption tax", 10, "JPY", "ja-JP", "Registration number"],
  KE: ["VAT", 16, "KES", "en-KE", "KRA PIN"],
  KR: ["VAT", 10, "KRW", "ko-KR", "Business number"],
  LK: ["VAT", 18, "LKR", "en-LK", "VAT number"],
  LT: ["VAT", 21, "EUR", "lt-LT", "VAT number"],
  LU: ["VAT", 17, "EUR", "fr-LU", "VAT number"],
  LV: ["VAT", 21, "EUR", "lv-LV", "VAT number"],
  MT: ["VAT", 18, "EUR", "en-MT", "VAT number"],
  MX: ["IVA", 16, "MXN", "es-MX", "RFC"],
  NG: ["VAT", 7.5, "NGN", "en-NG", "TIN"],
  NL: ["VAT", 21, "EUR", "nl-NL", "VAT number"],
  NO: ["VAT", 25, "NOK", "nb-NO", "Organisation number"],
  NP: ["VAT", 13, "NPR", "en-NP", "PAN"],
  NZ: ["GST", 15, "NZD", "en-NZ", "GST number"],
  OM: ["VAT", 5, "OMR", "en-OM", "VAT number"],
  PE: ["IGV", 18, "PEN", "es-PE", "RUC"],
  PH: ["VAT", 12, "PHP", "en-PH", "TIN"],
  PK: ["Sales tax", 18, "PKR", "en-PK", "NTN"],
  PL: ["VAT", 23, "PLN", "pl-PL", "NIP"],
  PT: ["IVA", 23, "EUR", "pt-PT", "NIF"],
  RO: ["VAT", 21, "RON", "ro-RO", "VAT number"],
  SA: ["VAT", 15, "SAR", "en-SA", "VAT number"],
  SE: ["VAT", 25, "SEK", "sv-SE", "VAT number"],
  SG: ["GST", 9, "SGD", "en-SG", "GST registration number"],
  SI: ["VAT", 22, "EUR", "sl-SI", "VAT number"],
  SK: ["VAT", 23, "EUR", "sk-SK", "VAT number"],
  TH: ["VAT", 7, "THB", "th-TH", "Tax ID"],
  TR: ["KDV", 20, "TRY", "tr-TR", "Tax number"],
  UA: ["VAT", 20, "UAH", "uk-UA", "Tax number"],
  VN: ["VAT", 10, "VND", "vi-VN", "Tax code"],
  ZA: ["VAT", 15, "ZAR", "en-ZA", "VAT number"]
};

// Countries with no national VAT, GST or sales tax: [currency, locale]
const NO_TAX = {
  HK: ["HKD", "en-HK"],
  KW: ["KWD", "en-KW"],
  QA: ["QAR", "en-QA"]
};

const INDIA_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
];

// Canada: GST alone, or GST plus the provincial tax, or HST, as one combined rate
const CANADA_RATES = [
  ["Alberta", 5],
  ["British Columbia", 12],
  ["Manitoba", 12],
  ["New Brunswick", 15],
  ["Newfoundland and Labrador", 15],
  ["Northwest Territories", 5],
  ["Nova Scotia", 14],
  ["Nunavut", 5],
  ["Ontario", 13],
  ["Prince Edward Island", 15],
  ["Quebec", 14.975],
  ["Saskatchewan", 11],
  ["Yukon", 5]
];

// United States: the state's own base rate. City and county rates come on top.
const US_RATES = [
  ["Alabama", 4],
  ["Alaska", 0],
  ["Arizona", 5.6],
  ["Arkansas", 6.5],
  ["California", 7.25],
  ["Colorado", 2.9],
  ["Connecticut", 6.35],
  ["Delaware", 0],
  ["District of Columbia", 6],
  ["Florida", 6],
  ["Georgia", 4],
  ["Hawaii", 4],
  ["Idaho", 6],
  ["Illinois", 6.25],
  ["Indiana", 7],
  ["Iowa", 6],
  ["Kansas", 6.5],
  ["Kentucky", 6],
  ["Louisiana", 5],
  ["Maine", 5.5],
  ["Maryland", 6],
  ["Massachusetts", 6.25],
  ["Michigan", 6],
  ["Minnesota", 6.875],
  ["Mississippi", 7],
  ["Missouri", 4.225],
  ["Montana", 0],
  ["Nebraska", 5.5],
  ["Nevada", 6.85],
  ["New Hampshire", 0],
  ["New Jersey", 6.625],
  ["New Mexico", 4.875],
  ["New York", 4],
  ["North Carolina", 4.75],
  ["North Dakota", 5],
  ["Ohio", 5.75],
  ["Oklahoma", 4.5],
  ["Oregon", 0],
  ["Pennsylvania", 6],
  ["Rhode Island", 7],
  ["South Carolina", 6],
  ["South Dakota", 4.2],
  ["Tennessee", 7],
  ["Texas", 6.25],
  ["Utah", 4.85],
  ["Vermont", 6],
  ["Virginia", 4.3],
  ["Washington", 6.5],
  ["West Virginia", 6],
  ["Wisconsin", 5],
  ["Wyoming", 4]
];

const AUSTRALIA_STATES = [
  "Australian Capital Territory",
  "New South Wales",
  "Northern Territory",
  "Queensland",
  "South Australia",
  "Tasmania",
  "Victoria",
  "Western Australia"
];

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Ajman",
  "Dubai",
  "Fujairah",
  "Ras Al Khaimah",
  "Sharjah",
  "Umm Al Quwain"
];

const REGIONS = {
  AE: UAE_EMIRATES,
  AU: AUSTRALIA_STATES,
  CA: CANADA_RATES.map(([region]) => region),
  IN: INDIA_STATES,
  US: US_RATES.map(([region]) => region)
};

const CONFIRM = "Confirm the rate with your tax adviser before invoicing.";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function base(code, overrides) {
  return {
    country: code,
    countryName: countryNames.of(code),
    system: "Tax",
    registrationLabel: "Tax ID",
    currency: "USD",
    locale: "en-US",
    mode: "single",
    rate: 0,
    splitLabels: ["", ""],
    crossLabel: "",
    regionLabel: "Region",
    regionRates: [],
    pricesIncludeTax: false,
    ...overrides
  };
}

function regionRates(rows) {
  return rows.map(([region, rate]) => ({ region, rate }));
}

// The countries whose tax is not one national rate
const SPECIAL = {
  IN: () => ({
    tax: base("IN", {
      system: "GST",
      registrationLabel: "GSTIN",
      currency: "INR",
      locale: "en-IN",
      mode: "split",
      rate: 18,
      splitLabels: ["CGST", "SGST"],
      crossLabel: "IGST",
      regionLabel: "State"
    }),
    note: `GST is split into CGST and SGST for a customer in your own state and charged as IGST for any other state. 18% is the most common slab; other slabs apply to some goods and services. ${CONFIRM}`
  }),
  CA: () => ({
    tax: base("CA", {
      system: "GST/HST",
      registrationLabel: "Business number",
      currency: "CAD",
      locale: "en-CA",
      mode: "regional",
      rate: 5,
      regionLabel: "Province",
      regionRates: regionRates(CANADA_RATES)
    }),
    note: `Each province's rate is the federal GST plus its provincial tax, or its HST, as one combined rate. ${CONFIRM}`
  }),
  US: () => ({
    tax: base("US", {
      system: "Sales tax",
      registrationLabel: "EIN",
      currency: "USD",
      locale: "en-US",
      mode: "regional",
      rate: 0,
      regionLabel: "State",
      regionRates: regionRates(US_RATES)
    }),
    note: `These are each state's base rate. City and county taxes come on top and you only collect where you have nexus, so edit the states you sell into. ${CONFIRM}`
  })
};

/** Starting settings for a country: { tax, note, regions, known }. `known` is false when the rate must be entered. */
export function getTaxPreset(code) {
  const regions = REGIONS[code] || [];
  if (SPECIAL[code]) {
    return { ...SPECIAL[code](), regions, known: true };
  }
  if (SINGLE_RATE[code]) {
    const [system, rate, currency, locale, registrationLabel] =
      SINGLE_RATE[code];
    return {
      tax: base(code, { system, rate, currency, locale, registrationLabel }),
      note: `${system} at the standard rate of ${rate}%. Reduced rates apply to some goods and services. ${CONFIRM}`,
      regions,
      known: true
    };
  }
  if (NO_TAX[code]) {
    const [currency, locale] = NO_TAX[code];
    return {
      tax: base(code, { mode: "none", currency, locale }),
      note: `${countryNames.of(code)} has no VAT, GST or sales tax on ordinary sales. ${CONFIRM}`,
      regions,
      known: true
    };
  }
  return {
    // no preset: keep the money format already in use rather than guessing one
    tax: base(code, {
      currency: getConfig().tax.currency,
      locale: getConfig().tax.locale
    }),
    note: `RevX has no preset for ${countryNames.of(code)}. Enter the tax name, the rate and the currency yourself.`,
    regions,
    known: false
  };
}

/** Every ISO country, sorted by name: [{ code, name, system, known }] */
export function getCountries() {
  return ISO_COUNTRIES.split(" ")
    .map((code) => {
      const { tax, known } = getTaxPreset(code);
      return {
        code,
        name: tax.countryName,
        system: tax.mode === "none" ? "No tax" : tax.system,
        known
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** State or province names for the country, or [] when Revquila has no list. */
export function getRegions(code) {
  return REGIONS[code] || [];
}

/** ISO 4217 codes the browser can format. */
export function getCurrencies() {
  return Intl.supportedValuesOf("currency");
}

function round(amount) {
  return Math.round(amount * 100) / 100;
}

/** Every market: the home one (Setup > Tax & currency) first, then the other countries. */
export function getMarkets() {
  const { tax, markets } = getConfig();
  return [{ ...tax, exchangeRate: 1 }].concat(
    (markets || []).map((market) => ({
      ...market,
      exchangeRate:
        Number(market.exchangeRate) > 0 ? Number(market.exchangeRate) : 1
    }))
  );
}

/** The market a customer in `country` (a code or a name) is priced in. Unknown or blank: the home market. */
export function marketOf(country) {
  const wanted = (country || "").trim().toLowerCase();
  const markets = getMarkets();
  return (
    (wanted &&
      markets.find(
        (market) =>
          market.country.toLowerCase() === wanted ||
          (market.countryName || "").toLowerCase() === wanted
      )) ||
    markets[0]
  );
}

function rateFor(tax, region) {
  if (tax.mode === "none") {
    return 0;
  }
  if (tax.mode === "regional") {
    const match = tax.regionRates.find((row) => row.region === region);
    return Number(match ? match.rate : tax.rate) || 0;
  }
  return Number(tax.rate) || 0;
}

function taxLines(tax, rate, amount, region, homeRegion) {
  if (tax.mode === "none") {
    return [];
  }
  if (tax.mode === "split" && region === homeRegion) {
    const half = round(amount / 2);
    return [
      {
        label: `${tax.splitLabels[0]} ${rate / 2}%`,
        rate: rate / 2,
        amount: half
      },
      {
        label: `${tax.splitLabels[1]} ${rate / 2}%`,
        rate: rate / 2,
        amount: round(amount - half)
      }
    ];
  }
  if (tax.mode === "split") {
    return [{ label: `${tax.crossLabel} ${rate}%`, rate, amount }];
  }
  const where = tax.mode === "regional" && region ? ` (${region})` : "";
  return [{ label: `${tax.system} ${rate}%${where}`, rate, amount }];
}

/**
 * Tax on an amount for a customer in place.region.
 * With pricesIncludeTax the amount already contains the tax, so the net is worked back from it.
 */
export function calculateTax(
  amount,
  place,
  tax = getConfig().tax,
  homeRegion = getConfig().company.state
) {
  const region = place ? place.region : undefined;
  const rate = rateFor(tax, region);
  const net = tax.pricesIncludeTax
    ? round(amount / (1 + rate / 100))
    : round(amount);
  const total = tax.pricesIncludeTax
    ? round(amount)
    : round(net * (1 + rate / 100));
  const taxAmount = round(total - net);
  return {
    net,
    lines: taxLines(tax, rate, taxAmount, region, homeRegion),
    tax: taxAmount,
    total
  };
}

function symbolOf(tax) {
  return new Intl.NumberFormat(tax.locale, {
    style: "currency",
    currency: tax.currency,
    maximumFractionDigits: 0
  })
    .formatToParts(0)
    .find((part) => part.type === "currency").value;
}

/** Full amount in the configured currency: "₹3,90,000". */
export function formatMoney(amount, options = {}) {
  const { decimals = 0, tax = getConfig().tax } = options;
  return new Intl.NumberFormat(tax.locale, {
    style: "currency",
    currency: tax.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
}

/** Short amount for tiles and lists: lakh and crore for rupees, K / M / B otherwise. */
export function formatMoneyCompact(amount, options = {}) {
  const { tax = getConfig().tax } = options;
  if (tax.currency === "INR") {
    const symbol = symbolOf(tax);
    if (Math.abs(amount) >= 1e7) {
      return `${symbol}${(amount / 1e7).toFixed(2)}Cr`;
    }
    if (Math.abs(amount) >= 1e5) {
      return `${symbol}${(amount / 1e5).toFixed(1)}L`;
    }
    return formatMoney(amount, { tax });
  }
  return new Intl.NumberFormat(tax.locale, {
    style: "currency",
    currency: tax.currency,
    notation: "compact",
    maximumFractionDigits: 1
  }).format(amount);
}

/**
 * Amount for a printed document: the ISO code, then the number with two decimals.
 * The PDF renderer has no glyph for many currency symbols, the rupee among them.
 */
export function formatDocumentMoney(amount, tax = getConfig().tax) {
  const number = new Intl.NumberFormat(tax.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  return `${tax.currency} ${number}`;
}

/** "30 Sep 2026" */
export function formatDate(date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date.length === 10 ? date + "T00:00:00" : date) : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  try {
    return new Intl.DateTimeFormat(getConfig().tax.locale || "en", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(d);
  } catch (e) {
    return d.toLocaleDateString();
  }
}