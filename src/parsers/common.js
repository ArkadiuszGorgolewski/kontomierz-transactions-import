const crypto = require("node:crypto");

function parseDelimitedRows(text, delimiter) {
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

    if ((char === "\n" || char === "\r") && !quoted) {
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

  return rows;
}

function rowsToObjects(rows, headerIndex = 0) {
  if (!rows[headerIndex]) {
    return [];
  }

  const headers = rows[headerIndex].map(header =>
    String(header || "").replace(/^\uFEFF/, "").trim()
  );

  return rows.slice(headerIndex + 1).map(values => {
    const result = {};

    headers.forEach((header, index) => {
      if (!header) return;
      result[header] = values[index] ?? "";
    });

    return result;
  });
}

function findHeaderRow(rows, expectedFirstCell) {
  const index = rows.findIndex(row =>
    String(row[0] || "").replace(/^\uFEFF/, "").trim() === expectedFirstCell
  );

  if (index === -1) {
    throw new Error(`Nie znaleziono nagłówka: ${expectedFirstCell}`);
  }

  return index;
}

function parseDecimal(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error("Brak kwoty transakcji");
  }

  let normalized = String(value)
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "");

  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    throw new Error(`Niepoprawna kwota: "${value}"`);
  }

  return number;
}

function normalizeDate(value) {
  const input = String(value || "").trim();

  if (!input) {
    throw new Error("Brak daty transakcji");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  let match = input.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  match = input.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  if (match) {
    return match[1];
  }

  throw new Error(`Nieobsługiwany format daty: "${value}"`);
}

function hash(parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map(value => String(value ?? "")).join("|"), "utf8")
    .digest("hex");
}

function cleanSpaces(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  parseDelimitedRows,
  rowsToObjects,
  findHeaderRow,
  parseDecimal,
  normalizeDate,
  hash,
  cleanSpaces,
};
