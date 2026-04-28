const ZERO_DECIMAL_CURRENCIES = new Set(["IDR", "JPY", "KRW"]);

export const isZeroDecimalCurrency = (code: string): boolean =>
  ZERO_DECIMAL_CURRENCIES.has(code);

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

export const getCurrencySymbol = (currencyCode: string): string =>
  CURRENCY_SYMBOLS[currencyCode] || currencyCode;

export const formatMoney = (value: number, currencyCode = "IDR"): string => {
  const isZero = isZeroDecimalCurrency(currencyCode);
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString(undefined, {
    minimumFractionDigits: isZero ? 0 : 2,
    maximumFractionDigits: isZero ? 0 : 2,
  });
};

export const isAmountEqual = (
  a: number,
  b: number,
  currencyCode = "IDR",
): boolean => {
  const tolerance = isZeroDecimalCurrency(currencyCode) ? 0.5 : 0.01;
  return Math.abs(a - b) < tolerance;
};

export const formatNumberInput = (
  value: string | number | undefined,
): string => {
  if (value === "" || value === null || value === undefined) return "";

  let strVal = value.toString().replace(/[^\d.]/g, "");

  // collapse multiple dots - keep only the first
  const firstDot = strVal.indexOf(".");
  if (firstDot !== -1) {
    strVal =
      strVal.slice(0, firstDot + 1) +
      strVal.slice(firstDot + 1).replace(/\./g, "");
  }

  const parts = strVal.split(".");
  let wholePart = parts[0] ?? "";
  const decimalPart = parts.length > 1 ? "." + parts[1].substring(0, 2) : "";

  // strip leading zeros (but keep a single "0" if that's all there is)
  wholePart = wholePart.replace(/^0+(?=\d)/, "");

  if (!wholePart && !decimalPart) return "";
  if (!wholePart) wholePart = "0";

  const formattedWhole = parseInt(wholePart, 10).toLocaleString("en-US");

  // preserve trailing "." while typing
  if (strVal.endsWith(".") && decimalPart === "") return formattedWhole + ".";

  return formattedWhole + decimalPart;
};

export const parseFormattedNumber = (
  formattedValue: string | number | undefined,
): number => {
  if (
    formattedValue === undefined ||
    formattedValue === null ||
    formattedValue === ""
  )
    return 0;
  const num = parseFloat(formattedValue.toString().replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
};