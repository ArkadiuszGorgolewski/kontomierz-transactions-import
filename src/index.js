const fs = require("node:fs/promises");

const config = require("./config");
const { parseAllBanks } = require("./parser");
const { findCategory } = require("./categories");
const {
  openKontomierz,
  addTransaction,
} = require("./kontomierz");

async function loadImported() {
  try {
    const text = await fs.readFile(config.importedFile, "utf8");
    const data = JSON.parse(text);
    return new Set(Array.isArray(data) ? data : []);
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

async function saveImported(imported) {
  await fs.writeFile(
    config.importedFile,
    JSON.stringify([...imported], null, 2),
    "utf8"
  );
}

async function saveErrors(errors) {
  await fs.writeFile(
    config.errorsFile,
    JSON.stringify(errors, null, 2),
    "utf8"
  );
}

async function main() {
  console.log("================================");
  console.log("Multi-bank → Kontomierz importer");
  console.log("================================");

  const { transactions } = await parseAllBanks(config.banks);

  console.log(`Łącznie w plikach: ${transactions.length}`);

  const imported = await loadImported();

  let pending = transactions.filter(transaction => !imported.has(transaction.id));

  console.log(`Już zaimportowane: ${transactions.length - pending.length}`);
  console.log(`Do importu: ${pending.length}`);

  if (config.maxTransactions !== null) {
    pending = pending.slice(0, config.maxTransactions);
    console.log(`Limit bezpieczeństwa: ${config.maxTransactions}`);
  }

  if (pending.length === 0) {
    console.log("Nie ma nowych transakcji.");
    return;
  }

  const { browser, context, page } = await openKontomierz();
  const errors = [];

  try {
    for (const transaction of pending) {
      try {
        transaction.category = findCategory(transaction);

        console.log("");
        console.log(
          `[${transaction.sourceBank}] ${transaction.bookingDate} | ` +
          `${transaction.amount.toFixed(2)} ${transaction.currency} | ` +
          `portfel: ${transaction.walletName}`
        );

        if (transaction.category?.category) {
          console.log(
            `Kategoria: ${transaction.category.category}` +
            (transaction.category.subcategory
              ? ` → ${transaction.category.subcategory}`
              : "") +
            (transaction.category.matchedBy
              ? ` [reguła: ${transaction.category.matchedBy}]`
              : "")
          );
        } else {
          console.log("Kategoria: Brak kategorii");
        }

        await addTransaction(page, transaction);

        imported.add(transaction.id);
        await saveImported(imported);
        await page.waitForTimeout(config.delay);
      } catch (error) {
        console.error("BŁĄD:", error.message);

        errors.push({
          sourceBank: transaction.sourceBank,
          transaction,
          error: error.message,
        });

        console.log("Import został zatrzymany na pierwszym błędzie.");
        break;
      }
    }

    if (errors.length > 0) {
      await saveErrors(errors);
    }

    await context.storageState({
      path: config.sessionFile,
    });
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("");
  console.error("BŁĄD GŁÓWNY:", error.message);
  process.exitCode = 1;
});
