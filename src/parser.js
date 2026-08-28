const fs = require("node:fs/promises");
const crypto = require("node:crypto");

function detectDelimiter(firstLine) {
  const delimiters = ["\t", ";", ","];

  let bestDelimiter = ",";
  let bestCount = -1;

  for (const delimiter of delimiters) {
    const count = firstLine.split(delimiter).length - 1;

    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCSVContent(text, delimiter) {
  const rows = [];

  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i++;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (
      (char === "\n" || char === "\r") &&
      !quoted
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field.trim());
      field = "";

      if (row.some(value => value !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field.trim());

    if (row.some(value => value !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(header =>
    header.replace(/^\uFEFF/, "").trim()
  );

  return rows.slice(1).map(values => {
    const result = {};

    headers.forEach((header, index) => {
      result[header] = values[index] ?? "";
    });

    return result;
  });
}

function parseAmount(value) {
  if (!value) {
    throw new Error("Brak kwoty transakcji");
  }

  let normalized = String(value)
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "");

  // 1.234,56
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(normalized)) {
    normalized = normalized
      .replace(/\./g, "")
      .replace(",", ".");
  }

  // 1,234.56
  else if (
    /^-?\d{1,3}(,\d{3})+\.\d+$/.test(normalized)
  ) {
    normalized = normalized.replace(/,/g, "");
  }

  // 1234,56
  else {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    throw new Error(
      `Niepoprawna kwota: ${value}`
    );
  }

  return number;
}

function normalizeDate(value) {
  const input = String(value || "").trim();

  if (!input) {
    throw new Error("Brak daty");
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY
  const match = input.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
  );

  if (match) {
    const [, day, month, year] = match;

    return [
      year,
      month.padStart(2, "0"),
      day.padStart(2, "0"),
    ].join("-");
  }

  // ISO z godziną
  const iso = input.match(
    /^(\d{4}-\d{2}-\d{2})[T ]/
  );

  if (iso) {
    return iso[1];
  }

  throw new Error(
    `Nieznany format daty: ${value}`
  );
}

function createDescription(row) {
  const partner =
    String(row["Partner Name"] || "").trim();

  const reference =
    String(row["Payment Reference"] || "").trim();

  // Najczęściej wystarczy nazwa kontrahenta.
  if (partner && reference) {
    // Jeżeli reference jest identyczne,
    // nie dodajemy go drugi raz.
    if (
      partner.toLowerCase() ===
      reference.toLowerCase()
    ) {
      return partner;
    }

    return `${partner} — ${reference}`;
  }

  return (
    partner ||
    reference ||
    String(row["Type"] || "").trim() ||
    "Transakcja N26"
  );
}

function createId(transaction) {
  const source = [
    transaction.bookingDate,
    transaction.amount,
    transaction.partnerName,
    transaction.partnerIban,
    transaction.paymentReference,
    transaction.type,
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(source)
    .digest("hex");
}

function mapTransaction(row) {
  const amount = parseAmount(
    row["Amount (EUR)"]
  );

  const transaction = {
    bookingDate: normalizeDate(
      row["Booking Date"]
    ),

    valueDate: row["Value Date"]
      ? normalizeDate(row["Value Date"])
      : null,

    amount,

    // Do formularza Kontomierza wpisujemy
    // zawsze dodatnią wartość.
    absoluteAmount: Math.abs(amount),

    type:
      String(row["Type"] || "").trim(),

    partnerName:
      String(row["Partner Name"] || "").trim(),

    partnerIban:
      String(row["Partner Iban"] || "").trim(),

    paymentReference:
      String(
        row["Payment Reference"] || ""
      ).trim(),

    accountName:
      String(row["Account Name"] || "").trim(),

    originalAmount:
      String(row["Original Amount"] || "").trim(),

    originalCurrency:
      String(
        row["Original Currency"] || ""
      ).trim(),

    exchangeRate:
      String(row["Exchange Rate"] || "").trim(),

    description: createDescription(row),

    direction:
      amount < 0 ? "expense" : "income",
  };

  transaction.id = createId(transaction);

  return transaction;
}

function validateHeaders(rows) {
  if (rows.length === 0) {
    throw new Error(
      "CSV nie zawiera żadnych transakcji."
    );
  }

  const required = [
    "Booking Date",
    "Partner Name",
    "Type",
    "Payment Reference",
    "Amount (EUR)",
  ];

  const headers = Object.keys(rows[0]);

  const missing = required.filter(
    header => !headers.includes(header)
  );

  if (missing.length) {
    throw new Error(
      "Brakuje kolumn: " +
      missing.join(", ")
    );
  }
}

async function parseCSV(file) {
  const text = await fs.readFile(
    file,
    "utf8"
  );

  const firstLine =
    text.split(/\r?\n/, 1)[0] || "";

  const delimiter =
    detectDelimiter(firstLine);

  console.log(
    "Wykryty separator:",
    delimiter === "\t"
      ? "TAB"
      : delimiter
  );

  const rows =
    parseCSVContent(text, delimiter);

  validateHeaders(rows);

  const transactions =
    rows.map(mapTransaction);

  return transactions;
}

module.exports = {
  parseCSV,
};