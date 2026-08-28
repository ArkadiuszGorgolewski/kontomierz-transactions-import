const { chromium } = require("playwright");
const readline = require("node:readline");
const config = require("./config");

function waitForEnter() {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "\nGdy będziesz już CAŁKOWICIE ZALOGOWANY do Kontomierza, naciśnij ENTER tutaj w Terminalu...\n",
      () => {
        rl.close();
        resolve();
      }
    );
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 150,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  await page.goto("https://app.kontomierz.pl/", {
    waitUntil: "domcontentloaded",
  });

  console.log("");
  console.log("================================");
  console.log("Logowanie do Kontomierza");
  console.log("================================");
  console.log("");
  console.log("1. Zaakceptuj cookies.");
  console.log("2. Zaloguj się normalnie.");
  console.log("3. Poczekaj aż zobaczysz właściwą aplikację Kontomierz.");
  console.log("4. NIE zamykaj przeglądarki.");
  console.log("5. Wróć do Terminala i naciśnij ENTER.");

  await waitForEnter();

  /*
   * Znajdujemy aktualną stronę Kontomierza.
   * Logowanie może otworzyć nową kartę/okno.
   */
  const pages = context.pages();

  let appPage = null;

  for (const candidate of pages) {
    if (
      candidate.url().startsWith(
        "https://app.kontomierz.pl"
      )
    ) {
      appPage = candidate;
    }
  }

  if (!appPage) {
    throw new Error(
      "Nie znaleziono otwartej aplikacji Kontomierza."
    );
  }

  await appPage.bringToFront();

  /*
   * Bardziej wiarygodne sprawdzenie:
   * ekran logowania posiada pole hasła.
   */
  const passwordInput = appPage.locator(
    'input[type="password"]'
  );

  const passwordCount =
    await passwordInput.count();

  if (passwordCount > 0) {
    throw new Error(
      "Nadal widzę ekran logowania. Najpierw zaloguj się, a dopiero potem naciśnij ENTER."
    );
  }

  console.log("");
  console.log(
    "Wygląda na to, że logowanie zakończyło się poprawnie."
  );

  /*
   * Zapis cookies + localStorage.
   */
  await context.storageState({
    path: config.sessionFile,
  });

  console.log("");
  console.log("Sesja została zapisana:");
  console.log(config.sessionFile);
  console.log("");

  await browser.close();
}

main().catch(error => {
  console.error("");
  console.error(
    "BŁĄD:",
    error.message
  );

  process.exitCode = 1;
});