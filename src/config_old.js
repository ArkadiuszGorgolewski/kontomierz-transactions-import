const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

module.exports = {
  // Nazwa rachunku widoczna w formularzu Kontomierza
  accountName: "N26 EUR",

  // Plik pobrany z N26
  csvFile: path.join(ROOT, "data", "transactions.csv"),

  // Sesja utworzona wcześniej przez Playwright Codegen
  sessionFile: path.join(ROOT, "kontomierz-session.json"),

  // Historia zaimportowanych transakcji
  importedFile: path.join(ROOT, "data", "imported.json"),

  // Błędy importu
  errorsFile: path.join(ROOT, "data", "errors.json"),

  // Adres Kontomierza
  kontomierzUrl: "https://app.kontomierz.pl/",

  // true = widzisz przeglądarkę
  headless: false,

  // Spowalnia Playwright, żeby było widać co robi
  slowMo: 200,

  // Dodatkowa przerwa między transakcjami
  delay: 500,

  // WAŻNE:
  // Na początku importujemy tylko 1 transakcję.
  // Po sprawdzeniu możesz ustawić np. 10,
  // a ostatecznie null.
  maxTransactions: null,
};