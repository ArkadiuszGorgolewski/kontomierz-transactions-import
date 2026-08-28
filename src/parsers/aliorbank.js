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

async function parseAliorBank(bankConfig) {
  const text = await fs.readFile(bankConfig.file, "utf8");
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = parseDelimitedRows(cleanText, "\t");
  const headerIndex = findHeaderRow(rows, "Data transakcji");
  const objects = rowsToObjects(rows, headerIndex);

  return objects
    .filter(row => String(row["Data transakcji"] || "").trim())
    .map(row => {
      const bookingDate = normalizeDate(row["Data transakcji"]);
      const valueDate = row["Data księgowania"]
        ? normalizeDate(row["Data księgowania"])
        : null;

      // Do portfela w Kontomierzu importujemy kwotę w walucie rachunku.
      const accountAmountRaw = cleanSpaces(row["Kwota w walucie rachunku"]);
      const operationAmountRaw = cleanSpaces(row["Kwota operacji"]);
      const amount = parseDecimal(accountAmountRaw || operationAmountRaw);
      const currency = cleanSpaces(row["Waluta rachunku"] || row["Waluta operacji"]).toUpperCase();

      const senderName = cleanSpaces(row["Nazwa nadawcy"]);
      const recipientName = cleanSpaces(row["Nazwa odbiorcy"]);
      const details = cleanSpaces(row["Szczegóły transakcji"]);
      const senderAccount = cleanSpaces(row["Numer rachunku nadawcy"]);
      const recipientAccount = cleanSpaces(row["Numer rachunku odbiorcy"]);

      const partnerName = amount < 0
        ? (recipientName || senderName)
        : (senderName || recipientName);

      const partnerIban = amount < 0
        ? (recipientAccount || senderAccount)
        : (senderAccount || recipientAccount);

      const descriptionParts = [partnerName, details].filter(Boolean);
      const description = descriptionParts.length
        ? [...new Set(descriptionParts)].join(" — ")
        : "Transakcja Alior Bank";

      const id = hash([
        "aliorbank",
        bookingDate,
        valueDate,
        amount,
        currency,
        senderName,
        recipientName,
        details,
        senderAccount,
        recipientAccount,
      ]);

      return {
        id,
        sourceBank: "aliorbank",
        sourceFile: bankConfig.file,
        walletName: bankConfig.walletName,
        bookingDate,
        valueDate,
        amount,
        absoluteAmount: Math.abs(amount),
        currency,
        direction: amount < 0 ? "expense" : "income",
        partnerName,
        partnerIban,
        paymentReference: details,
        type: "Alior Bank",
        description,
        senderName,
        recipientName,
        senderAccount,
        recipientAccount,
        originalAmount: operationAmountRaw,
        originalCurrency: cleanSpaces(row["Waluta operacji"]).toUpperCase(),
      };
    });
}

module.exports = { parseAliorBank };
