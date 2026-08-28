const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

module.exports = {
  kontomierzUrl: "https://app.kontomierz.pl/",
  sessionFile: path.join(ROOT, "kontomierz-session.json"),
  importedFile: path.join(ROOT, "data", "imported.json"),
  errorsFile: path.join(ROOT, "data", "errors.json"),
  categoriesFile: path.join(
  ROOT,
  "data",
  "categories.json"
),

  headless: false,
  slowMo: 200,
  delay: 500,

  // null = wszystkie nowe transakcje ze wszystkich włączonych banków.
  // Na czas testów można ustawić np. 1 albo 10.
  maxTransactions: null,

  banks: {
    n26: {
      enabled: true,
      file: path.join(ROOT, "data", "n26.csv"),
      walletName: "N26 EUR",
    },

    mbank: {
      enabled: true,
      file: path.join(ROOT, "data", "mbank.csv"),
      walletName: "mBank PLN",
    },

    aliorbank: {
      enabled: true,
      file: path.join(ROOT, "data", "aliorbank.csv"),
      walletName: "Alior PLN",
    },
  },
};
