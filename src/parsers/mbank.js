const fs = require("node:fs/promises");
const {
  parseDelimitedRows,
  rowsToObjects,
  findHeaderRow,
  parseDecimal,
  normalizeDate,
  hash,
  cleanSpaces,
} = require("./common");

function parseAmountAndCurrency(value) {
  const raw = cleanSpaces(value);
  const match = raw.match(/^(.+?)\s+([A-Za-z]{3})$/);

  if (!match) {
    throw new Error(`mBank: nie rozumiem kwoty: "${value}"`);
  }

  return {
    amount: parseDecimal(match[1]),
    currency: match[2].toUpperCase(),
  };
}

function extractPartnerName(description) {
  const clean = cleanSpaces(description);
  if (!clean) return "";

  // W eksporcie mBank nazwa kontrahenta często jest pierwszą częścią opisu.
  const commaIndex = clean.indexOf(",");
  if (commaIndex > 0) {
    return clean.slice(0, commaIndex).trim();
  }

  return clean;
}

async function parseMbank(bankConfig) {
  const text = await fs.readFile(bankConfig.file, "utf8");
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = parseDelimitedRows(cleanText, "\t");
  const headerIndex = findHeaderRow(rows, "#Data operacji");
  const objects = rowsToObjects(rows, headerIndex);

  return objects
    .filter(row => String(row["#Data operacji"] || "").trim())
    .map(row => {
      const bookingDate = normalizeDate(row["#Data operacji"]);
      const rawDescription = cleanSpaces(row["#Opis operacji"]);
      const accountName = cleanSpaces(row["#Rachunek"]);
      const sourceCategory = cleanSpaces(row["#Kategoria"]);
      const { amount, currency } = parseAmountAndCurrency(row["#Kwota"]);
      const partnerName = extractPartnerName(rawDescription);

      const id = hash([
        "mbank",
        bookingDate,
        amount,
        currency,
        accountName,
        rawDescription,
      ]);

      return {
        id,
        sourceBank: "mbank",
        sourceFile: bankConfig.file,
        walletName: bankConfig.walletName,
        bookingDate,
        valueDate: null,
        amount,
        absoluteAmount: Math.abs(amount),
        currency,
        direction: amount < 0 ? "expense" : "income",
        partnerName,
        partnerIban: "",
        paymentReference: rawDescription,
        type: "mBank",
        description: rawDescription || "Transakcja mBank",
        accountName,
        sourceCategory,
      };
    });
}

module.exports = { parseMbank };
