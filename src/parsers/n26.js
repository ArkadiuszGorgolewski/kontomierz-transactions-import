const fs = require("node:fs/promises");
const {
  parseDelimitedRows,
  rowsToObjects,
  parseDecimal,
  normalizeDate,
  hash,
  cleanSpaces,
} = require("./common");

function detectDelimiter(firstLine) {
  const delimiters = [",", ";", "\t"];
  return delimiters
    .map(delimiter => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function createDescription(row) {
  const partner = cleanSpaces(row["Partner Name"]);
  const reference = cleanSpaces(row["Payment Reference"]);

  if (partner && reference) {
    if (partner.toLowerCase() === reference.toLowerCase()) {
      return partner;
    }
    return `${partner} — ${reference}`;
  }

  return partner || reference || cleanSpaces(row["Type"]) || "Transakcja N26";
}

async function parseN26(bankConfig) {
  const text = await fs.readFile(bankConfig.file, "utf8");
  const cleanText = text.replace(/^\uFEFF/, "");
  const firstLine = cleanText.split(/\r?\n/, 1)[0] || "";
  const delimiter = detectDelimiter(firstLine);
  const rows = parseDelimitedRows(cleanText, delimiter);
  const objects = rowsToObjects(rows, 0);

  const required = ["Booking Date", "Partner Name", "Type", "Payment Reference", "Amount (EUR)"];
  const headers = objects[0] ? Object.keys(objects[0]) : [];
  const missing = required.filter(header => !headers.includes(header));

  if (missing.length) {
    throw new Error(`N26: brakuje kolumn: ${missing.join(", ")}`);
  }

  return objects
    .filter(row => String(row["Booking Date"] || "").trim())
    .map(row => {
      const amount = parseDecimal(row["Amount (EUR)"]);
      const bookingDate = normalizeDate(row["Booking Date"]);
      const valueDate = row["Value Date"] ? normalizeDate(row["Value Date"]) : null;
      const partnerName = cleanSpaces(row["Partner Name"]);
      const partnerIban = cleanSpaces(row["Partner Iban"]);
      const paymentReference = cleanSpaces(row["Payment Reference"]);
      const type = cleanSpaces(row["Type"]);
      const description = createDescription(row);

      // WAŻNE: ten hash zachowuje format używany wcześniej przez importer N26,
      // aby istniejący data/imported.json nadal chronił przed duplikatami.
      const id = hash([
        bookingDate,
        amount,
        partnerName,
        partnerIban,
        paymentReference,
        type,
      ]);

      return {
        id,
        sourceBank: "n26",
        sourceFile: bankConfig.file,
        walletName: bankConfig.walletName,
        bookingDate,
        valueDate,
        amount,
        absoluteAmount: Math.abs(amount),
        currency: "EUR",
        direction: amount < 0 ? "expense" : "income",
        partnerName,
        partnerIban,
        paymentReference,
        type,
        description,
        accountName: cleanSpaces(row["Account Name"]),
        originalAmount: cleanSpaces(row["Original Amount"]),
        originalCurrency: cleanSpaces(row["Original Currency"]),
        exchangeRate: cleanSpaces(row["Exchange Rate"]),
      };
    });
}

module.exports = { parseN26 };
