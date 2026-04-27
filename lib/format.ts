// currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  IDR: "Rp",
  SGD: "$",
  MYR: "RM",
  THB: "฿",
  JPY: "¥",
  KRW: "₩",
  AUD: "$",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

// currencies that don't use decimal subunits
const ZERO_DECIMAL_CURRENCIES = new Set(["IDR", "JPY", "KRW"]);

export const getCurrencySymbol = (currencyCode: string): string =>
  CURRENCY_SYMBOLS[currencyCode] || currencyCode;

export const isZeroDecimalCurrency = (currencyCode: string): boolean =>
  ZERO_DECIMAL_CURRENCIES.has(currencyCode);

// format the tailing decimals based on currency
export const formatMoney = (
  value: number | string | null | undefined,
  currencyCode: string = "IDR",
): string => {
  const num = typeof value === "number" ? value : parseFloat(String(value ?? 0));
  if (!Number.isFinite(num)) return "0";

  const isZeroDecimal = isZeroDecimalCurrency(currencyCode);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  });
};

// return the amount with currency
export const formatMoneyWithSymbol = (
  value: number | string | null | undefined,
  currencyCode: string = "IDR",
): string => {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol} ${formatMoney(value, currencyCode)}`;
};

// input amount format in form
export const formatNumberInput = (
  value: string | number | undefined,
  isZeroDecimal: boolean = true,
): string => {
  if (value === "" || value === null || value === undefined) return "";
  let strVal = String(value);

  // strip non-numeric except dot
  strVal = strVal.replace(/[^\d.]/g, "");

  // collapse multiple dots — keep first
  const firstDot = strVal.indexOf(".");
  if (firstDot !== -1) {
    strVal = strVal.slice(0, firstDot + 1) + strVal.slice(firstDot + 1).replace(/\./g, "");
  }

  // for zero-decimal currencies, drop the decimal portion entirely
  if (isZeroDecimal) {
    strVal = strVal.split(".")[0];
  }

  const parts = strVal.split(".");
  let wholePart = parts[0] || "";
  const decimalPart = parts.length > 1 ? "." + parts[1].substring(0, 2) : "";

  // strip leading zeros (but keep a single 0 before a decimal)
  wholePart = wholePart.replace(/^0+(?=\d)/, "");

  if (!wholePart && !decimalPart) return "";
  if (!wholePart) wholePart = "0";

  const formattedWhole = parseInt(wholePart, 10).toLocaleString("en-US");

  if (strVal.endsWith(".") && decimalPart === "") return formattedWhole + ".";

  return formattedWhole + decimalPart;
};

// returns the underlying number safely
export const parseFormattedNumber = (
  formattedValue: string | number | undefined,
): number => {
  if (formattedValue === undefined || formattedValue === null || formattedValue === "")
    return 0;
  const num = parseFloat(String(formattedValue).replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
};

// float safe comparison util
export const moneyEquals = (a: number, b: number, tolerance: number = 0.01): boolean =>
  Math.abs(a - b) < tolerance;

export const moneyIsZero = (n: number, tolerance: number = 0.01): boolean =>
  Math.abs(n) < tolerance;

// string for relative time ago
export const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};


// builds a Date object from the form picker's local-time fields and returns
// true UTC ISO string

// input:  { year, month (1-12), day, hour (0-23), minute }
// output: ISO 8601 string in UTC (e.g., "2026-04-27T07:30:00.000Z")
 
export const buildUTCFromLocal = (parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string => {
  const d = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  return d.toISOString();
};

// format a UTC timestamp string for display in the user's local timezone
// replaces all the scattered `toLocaleDateString("en-US", {...})` calls
export const formatDateDisplay = (
  isoString: string,
  style: "short" | "long" | "datetime" | "time" = "short",
): string => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";

  switch (style) {
    case "short":
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "long":
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "datetime":
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    case "time":
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
  }
};