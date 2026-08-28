const fs = require("node:fs/promises");
const { findCategory } = require("./categories");

const config = require("./config");
const { parseCSV } = require("./parser");
const {
  openKontomierz,
  addTransaction,
} = require("./kontomierz");

async function loadImported() {
  try {
    const text = await fs.readFile(
      config.importedFile,
      "utf8"
    );

    const data = JSON.parse(text);

    return new Set(
      Array.isArray(data) ? data : []
    );
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
    JSON.stringify(
      [...imported],
      null,
      2
    ),
    "utf8"
  );
}

async function saveErrors(errors) {
  await fs.writeFile(
    config.errorsFile,
    JSON.stringify(
      errors,
      null,
      2
    ),
    "utf8"
  );
}

async function main() {
  console.log("==========================");
  console.log("N26 → Kontomierz importer");
  console.log("==========================");

  const transactions =
    await parseCSV(config.csvFile);

  const imported =
    await loadImported();

  let pending =
    transactions.filter(
      transaction =>
        !imported.has(transaction.id)
    );

  if (
    config.maxTransactions !== null
  ) {
    pending = pending.slice(
      0,
      config.maxTransactions
    );
  }

  console.log(
    `Do importu: ${pending.length}`
  );

  if (pending.length === 0) {
    return;
  }

  const {
    browser,
    context,
    page,
  } = await openKontomierz();

  const errors = [];

  try {
    for (const transaction of pending) {
      try {
        transaction.category =
          findCategory(transaction);

        if (transaction.category.category) {
          console.log(
            `Kategoria: ${transaction.category.category}` +
            (
              transaction.category.subcategory
                ? ` → ${transaction.category.subcategory}`
                : ""
            ) +
            ` [reguła: "${transaction.category.matchedBy}"]`
          );
        } else {
          console.log("Kategoria: Brak kategorii");
        }

        await addTransaction(
          page,
          transaction
        );

        imported.add(
          transaction.id
        );

        await saveImported(
          imported
        );

        await page.waitForTimeout(
          config.delay
        );

      } catch (error) {
        console.error(
          "BŁĄD:",
          error.message
        );

        errors.push({
          transaction,
          error: error.message,
        });

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
  console.error(
    "BŁĄD GŁÓWNY:",
    error.message
  );

  process.exitCode = 1;
});