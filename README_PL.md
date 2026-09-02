# Kontomierz Transactions Import

Wielobankowy importer transakcji z plików CSV do Kontomierz.pl.

Aplikacja działa w Node.js i wykorzystuje Playwright do automatycznego wprowadzania transakcji przez interfejs webowy Kontomierza. Nie korzysta z publicznego API Kontomierza.

Projekt jest rozszerzalny: każdy bank może mieć własny parser CSV, ale wszystkie transakcje są zamieniane do wspólnego formatu i obsługiwane przez ten sam mechanizm importu.

## Funkcje

- import transakcji z wielu banków,
- osobny parser CSV dla każdego banku,
- wspólny format transakcji niezależnie od źródła,
- osobna nazwa portfela Kontomierza dla każdego banku,
- możliwość włączania i wyłączania źródeł,
- automatyczne pomijanie brakujących plików CSV,
- obsługa przychodów i wydatków,
- automatyczny wybór właściwego portfela,
- automatyczne ustawianie daty,
- obsługa polskiej i angielskiej lokalizacji kalendarza,
- automatyczne przechodzenie między miesiącami i latami,
- wspólne mapowanie kategorii dla wszystkich banków,
- kategorie zależne od kierunku transakcji,
- dopasowanie przez zwykły tekst lub RegExp,
- opcjonalne reguły kategorii zależne od banku,
- zapobieganie duplikatom,
- zatrzymanie importu przy błędzie,
- zapis błędów do pliku.

## Architektura

```text
CSV banku
   ↓
parser konkretnego banku
   ↓
wspólny format transakcji
   ↓
categories.js + data/categories.json
   ↓
Playwright
   ↓
Kontomierz
```

Każdy parser odpowiada wyłącznie za przekształcenie formatu konkretnego banku do wspólnego modelu.

## Wymagania

- Node.js 18 lub nowszy,
- npm,
- Playwright,
- konto Kontomierz,
- portfele utworzone w Kontomierzu,
- pliki CSV wyeksportowane z obsługiwanych banków.

Sprawdzenie Node.js:

```bash
node -v
npm -v
```

## Instalacja

```bash
cd kontomierz-transactions-import
npm install
npx playwright install chromium
```

Jeżeli projekt jest tworzony od początku:

```bash
npm init -y
npm install playwright
npx playwright install chromium
```

## Struktura projektu

```text
kontomierz-transactions-import/
├── package.json
├── package-lock.json
├── kontomierz-session.json
│
├── src/
│   ├── config.js
│   ├── parser.js
│   ├── categories.js
│   ├── kontomierz.js
│   ├── login.js
│   ├── index.js
│   └── parsers/
│       ├── common.js
│       ├── n26.js
│       ├── mbank.js
│       ├── aliorbank.js
│       └── ...
│
├── data/
│   ├── categories.json
│   ├── n26.csv
│   ├── mbank.csv
│   ├── aliorbank.csv
│   ├── ...
│   ├── imported.json
│   └── errors.json
│
└── examples/
    └── categories.example.json
```

Katalog `src/parsers/` może zawierać dowolną liczbę parserów.

Katalog `data/` zawiera dane prywatne i nie powinien być publikowany w repozytorium.

## Konfiguracja banków i portfeli

Konfiguracja znajduje się w:

```text
src/config.js
```

Przykład:

```javascript
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

module.exports = {
  kontomierzUrl: "https://app.kontomierz.pl/",

  sessionFile: path.join(
    ROOT,
    "kontomierz-session.json"
  ),

  categoriesFile: path.join(
    ROOT,
    "data",
    "categories.json"
  ),

  importedFile: path.join(
    ROOT,
    "data",
    "imported.json"
  ),

  errorsFile: path.join(
    ROOT,
    "data",
    "errors.json"
  ),

  headless: false,
  slowMo: 200,
  delay: 500,

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
      walletName: "Alior Bank PLN",
    },

    // Kolejne banki można dodawać tutaj.
  },
};
```

Liczba skonfigurowanych banków nie jest ograniczona.

### Nazwa portfela

`walletName` musi dokładnie odpowiadać nazwie portfela widocznej w Kontomierzu.

Przykład:

```javascript
walletName: "Konto osobiste PLN"
```

### Włączanie i wyłączanie banków

```javascript
enabled: true
```

Aby wyłączyć źródło:

```javascript
enabled: false
```

## Logowanie

Logowanie jest oddzielone od importu:

```bash
node src/login.js
```

Następnie:

1. zaloguj się ręcznie w Chromium,
2. poczekaj na załadowanie aplikacji,
3. nie zamykaj przeglądarki,
4. wróć do Terminala,
5. naciśnij Enter.

Sesja zostanie zapisana w:

```text
kontomierz-session.json
```

Jeżeli sesja wygaśnie:

```bash
node src/login.js
```

## Import

Umieść aktualne CSV w katalogu:

```text
data/
```

Następnie:

```bash
node src/index.js
```

Program:

1. odczytuje konfigurację banków,
2. pomija wyłączone źródła,
3. pomija brakujące CSV,
4. uruchamia odpowiedni parser,
5. normalizuje transakcje,
6. łączy je do wspólnej listy,
7. pomija już zaimportowane transakcje,
8. dopasowuje kategorię,
9. otwiera Kontomierz,
10. wybiera właściwy portfel,
11. ustawia datę,
12. wybiera `Wydatek` lub `Przychód`,
13. wpisuje kwotę,
14. wybiera kategorię i subkategorię,
15. zapisuje transakcję,
16. zapisuje jej ID w `data/imported.json`.

## Wspólny format transakcji

Każdy parser powinien zwracać obiekt w tym samym formacie:

```javascript
{
  id,

  sourceBank,
  sourceFile,
  walletName,

  bookingDate,
  valueDate,

  amount,
  absoluteAmount,
  currency,
  direction,

  partnerName,
  partnerIban,
  paymentReference,
  type,
  description
}
```

Kierunek transakcji:

```text
expense
```

dla wydatku oraz:

```text
income
```

dla przychodu.

## Parsery bankowe

Parsery znajdują się w:

```text
src/parsers/
```

Przykład:

```text
src/parsers/n26.js
src/parsers/mbank.js
src/parsers/aliorbank.js
src/parsers/deutschebank.js
src/parsers/revolut.js
```

Parser odpowiada m.in. za:

- znalezienie właściwego nagłówka,
- separator CSV,
- konwersję dat,
- konwersję kwot,
- ustalenie waluty,
- kierunek transakcji,
- kontrahenta,
- opis,
- stabilne ID,
- `sourceBank`,
- `walletName`.

## Rejestr parserów

`src/parser.js` przechowuje rejestr parserów.

Przykład:

```javascript
const { parseN26 } = require("./parsers/n26");
const { parseMbank } = require("./parsers/mbank");
const { parseAliorBank } = require("./parsers/aliorbank");

const PARSERS = {
  n26: parseN26,
  mbank: parseMbank,
  aliorbank: parseAliorBank,
};
```

## Dodanie kolejnego banku

1. Dodaj CSV, np.:

```text
data/deutschebank.csv
```

2. Utwórz parser:

```text
src/parsers/deutschebank.js
```

3. Zarejestruj go w `src/parser.js`.

4. Dodaj konfigurację w `src/config.js`:

```javascript
deutschebank: {
  enabled: true,
  file: path.join(
    ROOT,
    "data",
    "deutschebank.csv"
  ),
  walletName: "Deutsche Bank EUR",
},
```

Po tych zmianach pozostała część aplikacji nie wymaga modyfikacji.

## Kategorie

Logika kategorii znajduje się w:

```text
src/categories.js
```

Prywatne reguły znajdują się w:

```text
data/categories.json
```

Kod aplikacji i dane kategorii są dzięki temu rozdzielone.

### Przygotowanie pliku kategorii

Repozytorium powinno zawierać przykładowy plik:

```text
examples/categories.example.json
```

Po sklonowaniu projektu:

```bash
mkdir -p data
cp examples/categories.example.json data/categories.json
```

Następnie edytuj:

```text
data/categories.json
```

zgodnie z własnymi potrzebami.

## Zwykłe dopasowanie tekstowe

Najprostsza reguła:

```json
{
  "match": "Telekom",
  "direction": "expense",
  "category": "Rachunki i media",
  "subcategory": "Internet"
}
```

Kilka wartości:

```json
{
  "match": [
    "LIDL",
    "REWE",
    "ALDI"
  ],
  "direction": "expense",
  "category": "Zakupy",
  "subcategory": "Spożywcze"
}
```

`match` działa jako częściowe dopasowanie tekstu.

Przykładowo:

```text
LIDL 2179 München
```

zostanie dopasowane przez:

```json
"LIDL"
```

## RegExp w JSON

JSON nie obsługuje bezpośrednio JavaScriptowego zapisu:

```javascript
/\bFestnetz\b/i
```

Dlatego regex zapisuje się jako obiekt:

```json
{
  "matchRegex": [
    {
      "pattern": "\\bFestnetz\\b",
      "flags": "i"
    }
  ],
  "direction": "expense",
  "category": "Rachunki i media",
  "subcategory": "Internet"
}
```

Kilka regexów:

```json
{
  "matchRegex": [
    {
      "pattern": "\\bShell\\b",
      "flags": "i"
    },
    {
      "pattern": "\\bAral\\b",
      "flags": "i"
    },
    {
      "pattern": "\\bOrlen\\b",
      "flags": "i"
    }
  ],
  "direction": "expense",
  "category": "Samochód",
  "subcategory": "Paliwo"
}
```

Można też użyć jednego bardziej złożonego regexu:

```json
{
  "matchRegex": [
    {
      "pattern": "\\b(Shell|Aral|Orlen|BP)\\b",
      "flags": "i"
    }
  ],
  "direction": "expense",
  "category": "Samochód",
  "subcategory": "Paliwo"
}
```

## Kierunek reguły kategorii

Tylko wydatki:

```json
"direction": "expense"
```

Tylko przychody:

```json
"direction": "income"
```

Oba:

```json
"direction": "both"
```

Przykład przychodu:

```json
{
  "match": [
    "GEHALT",
    "SALARY",
    "WYNAGRODZENIE"
  ],
  "direction": "income",
  "category": "Przychód",
  "subcategory": "Pensja"
}
```

## Reguły zależne od banku

Regułę można opcjonalnie ograniczyć do jednego banku:

```json
{
  "bank": "mbank",
  "match": "PRZELEW WEWNĘTRZNY",
  "direction": "both",
  "category": "Inne",
  "subcategory": "Przelewy"
}
```

Wtedy reguła działa tylko, gdy:

```javascript
transaction.sourceBank === "mbank"
```

## Przykładowy `categories.example.json`

Przykładowy plik powinien zawierać zarówno zwykłe `match`, jak i `matchRegex`, np.:

```json
[
  {
    "match": [
      "LIDL",
      "REWE",
      "ALDI"
    ],
    "direction": "expense",
    "category": "Zakupy",
    "subcategory": "Spożywcze"
  },
  {
    "match": "Telekom",
    "direction": "expense",
    "category": "Rachunki i media",
    "subcategory": "Internet"
  },
  {
    "matchRegex": [
      {
        "pattern": "\\bFestnetz\\b",
        "flags": "i"
      }
    ],
    "direction": "expense",
    "category": "Rachunki i media",
    "subcategory": "Internet"
  }
]
```

## Zapobieganie duplikatom

Po poprawnym imporcie ID transakcji jest zapisywane w:

```text
data/imported.json
```

Przy kolejnych uruchomieniach importer pomija zapisane ID.

Każdy parser powinien generować stabilne ID na podstawie danych źródłowych.

## Obsługa błędów

Błędy są zapisywane w:

```text
data/errors.json
```

Importer zatrzymuje się przy pierwszym błędzie.

Transakcja trafia do `data/imported.json` dopiero po pomyślnym zapisaniu jej w Kontomierzu.

Po naprawieniu błędu można ponownie uruchomić:

```bash
node src/index.js
```

## Kalendarz

Importer wykorzystuje React Calendar.

Najważniejsze selektory:

```css
.react-calendar__navigation__label
.react-calendar__navigation__prev-button
.react-calendar__navigation__next-button
```

Dzień jest wyszukiwany przez element:

```html
<abbr aria-label="August 1, 2026">
```

Obsługiwane są polskie i angielskie nazwy miesięcy.

## Wybór portfela

Dropdown portfela jest identyfikowany przez:

```css
button[data-name="wallet"]
```

Nazwa portfela pochodzi z:

```javascript
transaction.walletName
```

## `.gitignore`

Katalog `data/` zawiera prywatne dane i powinien być ignorowany.

Zalecany `.gitignore`:

```gitignore
node_modules/

kontomierz-session.json

data/*
!data/.gitkeep

.env
```

Dzięki temu automatycznie ignorowane są:

```text
data/categories.json
data/*.csv
data/imported.json
data/errors.json
```

Przykładowe kategorie znajdują się poza `data/`:

```text
examples/categories.example.json
```

i mogą być bezpiecznie publikowane w repozytorium.

Jeżeli chcesz zachować pusty katalog `data/` w Git:

```bash
touch data/.gitkeep
```

## Typowy workflow

Pierwsze logowanie:

```bash
node src/login.js
```

Przygotowanie kategorii:

```bash
mkdir -p data
cp examples/categories.example.json data/categories.json
```

Umieść eksporty bankowe w `data/`, a następnie:

```bash
node src/index.js
```

Po wygaśnięciu sesji:

```bash
node src/login.js
node src/index.js
```

## Testowanie

Przy pierwszym uruchomieniu lub dodaniu nowego parsera:

```javascript
maxTransactions: 1
```

Sprawdź:

- datę,
- kwotę,
- walutę,
- kierunek,
- portfel,
- opis,
- kategorię,
- subkategorię.

Następnie:

```javascript
maxTransactions: 10
```

a po potwierdzeniu działania:

```javascript
maxTransactions: null
```

## Ważna uwaga

Importer automatyzuje interfejs webowy Kontomierza. Zmiany w HTML, nazwach pól, dropdownach, przyciskach lub datepickerze mogą wymagać aktualizacji selektorów Playwright.

Parsery bankowe są niezależne od mechanizmu automatyzacji Kontomierza, dlatego zmiana formatu CSV jednego banku powinna wymagać aktualizacji wyłącznie parsera tego banku.
