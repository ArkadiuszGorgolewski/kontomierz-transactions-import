const { chromium } = require("playwright");
const fs = require("node:fs");

const config = require("./config");

async function openKontomierz() {
  if (!fs.existsSync(config.sessionFile)) {
    throw new Error(
      "Brak zapisanej sesji. Uruchom: node src/login.js"
    );
  }

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
  });

  const context = await browser.newContext({
    storageState: config.sessionFile,
  });

  const page = await context.newPage();

  await page.goto(
    config.kontomierzUrl,
    {
      waitUntil: "domcontentloaded",
    }
  );

  await page.waitForTimeout(2000);

  console.log(
    "Aktualny URL:",
    page.url()
  );

  /*
   * Jeśli widzimy pole hasła,
   * jesteśmy na ekranie logowania.
   */
  const passwordInput = page.locator(
    'input[type="password"]'
  );

  const loginVisible =
    (await passwordInput.count()) > 0;

  if (loginVisible) {
    await browser.close();

    throw new Error(
      "Sesja Kontomierza wygasła. Uruchom: node src/login.js"
    );
  }

  console.log(
    "Sesja Kontomierza jest aktywna."
  );

  return {
    browser,
    context,
    page,
  };
}

async function setDate(page, date) {
  const input = page.locator('input[name="date"]');

  await input.waitFor({
    state: "visible",
    timeout: 5000,
  });

  // Otwórz kalendarz
  await input.click();

  const parsedDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Niepoprawna data: ${date}`);
  }

  /*
   * Nazwy miesięcy używane przez kalendarz.
   * Obsługujemy zarówno polski, jak i angielski.
   */
  const MONTHS = {
    pl: {
      nominative: [
        "styczeń",
        "luty",
        "marzec",
        "kwiecień",
        "maj",
        "czerwiec",
        "lipiec",
        "sierpień",
        "wrzesień",
        "październik",
        "listopad",
        "grudzień",
      ],

      genitive: [
        "stycznia",
        "lutego",
        "marca",
        "kwietnia",
        "maja",
        "czerwca",
        "lipca",
        "sierpnia",
        "września",
        "października",
        "listopada",
        "grudnia",
      ],
    },

    en: [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ],
  };

  const targetDay = parsedDate.getDate();
  const targetMonth = parsedDate.getMonth();
  const targetYear = parsedDate.getFullYear();

  /*
   * Nagłówek kalendarza, np.:
   *
   * August 2026
   *
   * albo:
   *
   * sierpień 2026
   */
  const monthButton = page.locator(
    ".react-calendar__navigation__label"
  );

  await monthButton.waitFor({
    state: "visible",
    timeout: 5000,
  });

  /*
   * Strzałki poprzedni / następny miesiąc.
   */
  const previousButton = page.locator(
    ".react-calendar__navigation__prev-button"
  );

  const nextButton = page.locator(
    ".react-calendar__navigation__next-button"
  );

  /*
   * Odczytuje miesiąc z nagłówka kalendarza.
   */
  function parseMonthLabel(label) {
    const normalized = label
      .trim()
      .toLowerCase();

    const match = normalized.match(
      /^(.+?)\s+(\d{4})$/
    );

    if (!match) {
      throw new Error(
        `Nie rozumiem nagłówka kalendarza: "${label}"`
      );
    }

    const monthName = match[1];
    const year = Number(match[2]);

    /*
     * Najpierw sprawdzamy język polski.
     */
    let month =
      MONTHS.pl.nominative.indexOf(monthName);

    if (month !== -1) {
      return {
        month,
        year,
        locale: "pl",
      };
    }

    /*
     * Następnie angielski.
     */
    month = MONTHS.en.indexOf(monthName);

    if (month !== -1) {
      return {
        month,
        year,
        locale: "en",
      };
    }

    throw new Error(
      `Nieznana nazwa miesiąca: "${monthName}"`
    );
  }

  /*
   * Zamieniamy miesiąc + rok na jedną liczbę.
   *
   * Dzięki temu łatwo ustalić, czy trzeba
   * iść do przodu czy do tyłu.
   */
  const targetValue =
    targetYear * 12 + targetMonth;

  let calendarLocale = null;
  let attempts = 0;

  /*
   * Przechodzimy do właściwego miesiąca.
   */
  while (true) {
    const currentLabel =
      (await monthButton.innerText()).trim();

    console.log(
      `Kalendarz pokazuje: ${currentLabel}`
    );

    const current =
      parseMonthLabel(currentLabel);

    calendarLocale = current.locale;

    const currentValue =
      current.year * 12 + current.month;

    /*
     * Właściwy miesiąc.
     */
    if (currentValue === targetValue) {
      break;
    }

    attempts++;

    /*
     * Zabezpieczenie przed nieskończoną pętlą.
     */
    if (attempts > 120) {
      throw new Error(
        "Nie udało się przejść do właściwego miesiąca."
      );
    }

    /*
     * Docelowa data jest wcześniej.
     */
    if (targetValue < currentValue) {
      console.log("← poprzedni miesiąc");

      await previousButton.click();
    }

    /*
     * Docelowa data jest później.
     */
    else {
      console.log("→ następny miesiąc");

      await nextButton.click();
    }

    /*
     * Poczekaj na aktualizację React Calendar.
     */
    await page.waitForTimeout(150);
  }

  /*
   * Budujemy aria-label dnia zależnie
   * od języka kalendarza.
   */
  let dayLabel;

  if (calendarLocale === "pl") {
    dayLabel =
      `${targetDay} ` +
      `${MONTHS.pl.genitive[targetMonth]} ` +
      `${targetYear}`;
  } else {
    const month =
      MONTHS.en[targetMonth];

    const capitalizedMonth =
      month.charAt(0).toUpperCase() +
      month.slice(1);

    dayLabel =
      `${capitalizedMonth} ` +
      `${targetDay}, ` +
      `${targetYear}`;
  }

  console.log(
    `Szukam dnia: "${dayLabel}"`
  );

  /*
   * Szukamy konkretnego dnia po aria-label.
   */
  const dayAbbr = page.locator(
    `abbr[aria-label="${dayLabel}"]`
  );

  await dayAbbr.waitFor({
    state: "visible",
    timeout: 5000,
  });

  // klikamy rodzica <button>
  const dayButton = dayAbbr.locator("..");

  await dayButton.click();

  console.log(
    `✓ Wybrano datę ${date}`
  );
}

async function selectTransactionType(page, transaction) {
  const form = page.locator("form");

  if (transaction.direction === "expense") {
    await form
      .getByText("Wydatek", {
        exact: true,
      })
      .click();

    console.log("✓ Wybrano: Wydatek");
  } else {
    await form
      .getByText("Przychód", {
        exact: true,
      })
      .click();

    console.log("✓ Wybrano: Przychód");
  }
}

async function selectAccount(page) {
  // Otwórz dropdown portfela
  const walletButton = page.locator(
    'button[data-name="wallet"]'
  );

  await walletButton.waitFor({
    state: "visible",
    timeout: 5000,
  });

  await walletButton.click();

  // Wybierz N26 EUR
  const n26Option = page
    .getByRole("listbox")
    .getByText("N26 EUR", {
      exact: true,
    });

  await n26Option.waitFor({
    state: "visible",
    timeout: 5000,
  });

  await n26Option.click();

  // Krótka chwila na aktualizację formularza
  await page.waitForTimeout(300);

  console.log("✓ Wybrano portfel N26 EUR");
}

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

async function selectCategory(page, transaction) {
  const category =
    transaction.category;

  /*
   * Otwieramy dropdown kategorii.
   */
  const categorySelector = page
    .locator("form")
    .getByRole("combobox")
    .filter({
      hasText: /Brak kategorii/,
    });

  await categorySelector.click();

  /*
   * Jeśli nie znaleziono reguły kategorii,
   * wybieramy "Brak kategorii".
   */
  if (!category || !category.category) {
    const noCategory = page
      .getByRole("listbox")
      .getByText("Brak kategorii", {
        exact: true,
      });

    await noCategory.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await noCategory.click();

    console.log("✓ Brak kategorii");
    return;
  }

  console.log(
    `Wybieram kategorię: ${category.category}`
  );

  /*
   * Kategoria główna.
   */
  const mainCategory = page
    .getByRole("listbox")
    .locator("div")
    .filter({
      hasText: new RegExp(
        `^${escapeRegExp(category.category)}$`
      ),
    })
    .first();

  await mainCategory.waitFor({
    state: "visible",
    timeout: 5000,
  });

  await mainCategory.click();

  /*
   * Jeśli nie ma subkategorii,
   * kończymy tutaj.
   */
  if (!category.subcategory) {
    console.log(
      `✓ ${category.category}`
    );

    return;
  }

  /*
   * Dajemy UI chwilę na pokazanie subkategorii.
   */
  await page.waitForTimeout(200);

  console.log(
    `Wybieram subkategorię: ${category.subcategory}`
  );

  const subcategory = page
    .getByRole("listbox")
    .getByText(category.subcategory, {
      exact: true,
    });

  await subcategory.waitFor({
    state: "visible",
    timeout: 5000,
  });

  await subcategory.click();

  console.log(
    `✓ ${category.category} → ${category.subcategory}`
  );
}

async function addTransaction(
  page,
  transaction
) {
  console.log("");
  console.log(
    "Dodaję:",
    transaction.description
  );

  console.log(
    "Data:",
    transaction.bookingDate
  );

  console.log(
    "Kwota:",
    transaction.amount,
    "EUR"
  );

  await page
    .locator(".css-sh2thy")
    .first()
    .click();

  const descriptionInput =
    page.getByRole(
      "textbox",
      {
        name: "Np. zakupy",
      }
    );

  await descriptionInput.fill(
    transaction.description
  );

  await setDate(
    page,
    transaction.bookingDate
  );

  await selectTransactionType(
    page,
    transaction
  );

  await selectAccount(page);

  const amountInput =
    page.getByRole("spinbutton");

  await amountInput.fill(
    transaction.absoluteAmount.toFixed(2)
  );

  await selectCategory(
    page,
    transaction
  );

  const addButton =
    page.getByRole(
      "button",
      {
        name: "Dodaj",
        exact: true,
      }
    );
  await page.waitForTimeout(500);
  await addButton.click();

  try {
    await addButton.waitFor({
      state: "hidden",
      timeout: 10000,
    });
  } catch {
    throw new Error(
      "Nie mogę potwierdzić zapisania transakcji."
    );
  }

  console.log("✓ Dodano");
}

module.exports = {
  openKontomierz,
  addTransaction,
};