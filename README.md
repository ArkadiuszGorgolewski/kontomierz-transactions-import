# Multi-bank → Kontomierz Importer

Importer transakcji z plików CSV do Kontomierz.pl.

Aplikacja działa w Node.js i wykorzystuje Playwright do automatycznego wprowadzania transakcji przez interfejs webowy Kontomierza. Nie korzysta z publicznego API Kontomierza.

Projekt jest zaprojektowany jako importer wielobankowy. Każdy bank może mieć własny parser CSV, ale po sparsowaniu wszystkie transakcje są zamieniane do wspólnego formatu i obsługiwane przez ten sam mechanizm importu do Kontomierza.

Dodanie kolejnego banku nie wymaga przebudowy całej aplikacji — wystarczy dodać parser oraz konfigurację źródła.

## Funkcje

- import transakcji z wielu banków,
- osobny parser CSV dla każdego banku,
- wspólny format transakcji niezależnie od źródła,
- osobna nazwa portfela Kontomierza dla każdego banku,
- możliwość włączania i wyłączania poszczególnych źródeł,
- automatyczne pomijanie brakujących plików CSV,
- obsługa przychodów i wydatków,
- automatyczny wybór właściwego portfela,
- automatyczne ustawianie daty w kalendarzu,
- obsługa polskiej i angielskiej lokalizacji kalendarza,
- automatyczne przechodzenie między miesiącami,
- wspólne mapowanie kategorii i subkategorii dla wszystkich banków,
- reguły kategorii zależne od przychodu lub wydatku,
- dopasowanie po fragmencie tekstu lub RegExp,
- zapamiętywanie już zaimportowanych transakcji,
- ochrona przed ponownym importem tych samych operacji,
- zatrzymanie importu przy pierwszym błędzie,
- zapis informacji o błędach.

## Architektura

```text
CSV banku
   ↓
parser konkretnego banku
   ↓
wspólny format transakcji
   ↓
mapowanie kategorii
   ↓
Playwright
   ↓
Kontomierz
```

Każdy parser odpowiada tylko za przekształcenie własnego formatu CSV do wspólnego modelu. Reszta aplikacji nie musi wiedzieć, z którego banku pochodzi transakcja.

## Wymagania

- Node.js 18 lub nowszy,
- npm,
- Playwright,
- konto Kontomierz,
- ręcznie utworzone portfele odpowiadające importowanym rachunkom,
- pliki CSV wyeksportowane z obsługiwanych banków.

Sprawdzenie:

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

Jeśli projekt jest tworzony od początku:

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
└── data/
    ├── n26.csv
    ├── mbank.csv
    ├── aliorbank.csv
    ├── ...
    ├── imported.json
    └── errors.json
```

Katalog `src/parsers/` może zawierać dowolną liczbę parserów. Analogicznie katalog `data/` może zawierać pliki CSV z dowolnej liczby skonfigurowanych banków.

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

  sessionFile: path.join(ROOT, "kontomierz-session.json"),
  importedFile: path.join(ROOT, "data", "imported.json"),
  errorsFile: path.join(ROOT, "data", "errors.json"),

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

Liczba pozycji w `banks` nie jest ograniczona.

### Nazwy portfeli

`walletName` musi dokładnie odpowiadać nazwie portfela widocznej w dropdownie Kontomierza.

```javascript
walletName: "Konto osobiste PLN"
```

Importer wybiera portfel osobno dla każdej transakcji na podstawie źródła.

### Włączanie i wyłączanie źródeł

```javascript
enabled: true
```

Aby wyłączyć bank:

```javascript
enabled: false
```

### Brakujący CSV

Nie trzeba posiadać wszystkich skonfigurowanych plików przy każdym uruchomieniu. Brakujący plik może zostać pominięty, a importer będzie kontynuował pracę z pozostałymi źródłami.

## Limit bezpieczeństwa

Podczas testowania:

```javascript
maxTransactions: 1
```

lub:

```javascript
maxTransactions: 10
```

Aby importować wszystkie nowe transakcje:

```javascript
maxTransactions: null
```

Limit dotyczy wspólnej listy nowych transakcji ze wszystkich aktywnych źródeł.

## Logowanie do Kontomierza

```bash
node src/login.js
```

Następnie:

1. zaloguj się ręcznie w otwartym Chromium,
2. poczekaj na załadowanie aplikacji Kontomierz,
3. nie zamykaj przeglądarki,
4. wróć do Terminala,
5. naciśnij Enter.

Sesja zostanie zapisana w:

```text
kontomierz-session.json
```

Jeżeli sesja wygaśnie, ponownie uruchom:

```bash
node src/login.js
```

## Import

Umieść pliki CSV skonfigurowanych banków w katalogu `data/`, a następnie:

```bash
node src/index.js
```

Program:

1. odczytuje konfigurację źródeł,
2. pomija wyłączone źródła,
3. pomija brakujące pliki,
4. uruchamia odpowiedni parser dla każdego banku,
5. zamienia transakcje do wspólnego formatu,
6. łączy wszystkie transakcje,
7. sortuje je,
8. pomija transakcje już zapisane w `imported.json`,
9. dopasowuje kategorię,
10. otwiera Kontomierz,
11. wybiera właściwy portfel,
12. ustawia datę,
13. wybiera `Wydatek` lub `Przychód`,
14. wpisuje kwotę,
15. wybiera kategorię i subkategorię,
16. zapisuje transakcję,
17. zapisuje jej ID w `data/imported.json`.

## Wspólny format transakcji

Każdy parser powinien zwracać obiekty w tym samym formacie:

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

`direction`:

```text
expense
```

dla wydatku oraz:

```text
income
```

dla przychodu.

## Parsery

Każdy bank ma własny moduł w:

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

Parser odpowiada za:

- znalezienie właściwego nagłówka CSV,
- wybór separatora,
- konwersję dat,
- konwersję kwot,
- ustalenie waluty,
- rozpoznanie przychodu lub wydatku,
- wyciągnięcie kontrahenta,
- utworzenie opisu,
- wygenerowanie stabilnego ID,
- przypisanie `sourceBank`,
- przypisanie `walletName`.

## Rejestr parserów

`src/parser.js` pełni rolę rejestru parserów.

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

1. Dodaj plik CSV, np.:

```text
data/deutschebank.csv
```

2. Utwórz parser:

```text
src/parsers/deutschebank.js
```

3. Zarejestruj go w `src/parser.js`:

```javascript
const {
  parseDeutscheBank
} = require("./parsers/deutschebank");

const PARSERS = {
  n26: parseN26,
  mbank: parseMbank,
  aliorbank: parseAliorBank,
  deutschebank: parseDeutscheBank,
};
```

4. Dodaj konfigurację w `src/config.js`:

```javascript
deutschebank: {
  enabled: true,
  file: path.join(ROOT, "data", "deutschebank.csv"),
  walletName: "Deutsche Bank EUR",
},
```

Po tych zmianach reszta aplikacji nie wymaga modyfikacji.

## Funkcje wspólne parserów

Kod wspólny powinien znajdować się w:

```text
src/parsers/common.js
```

Mogą tam znajdować się funkcje takie jak:

```javascript
parseAmount()
normalizeDate()
createHash()
parseDelimitedRows()
detectDelimiter()
```

## Kategorie

Reguły znajdują się w:

```text
src/categories.js
```

Kategorie działają na wspólnym formacie transakcji, dlatego te same reguły mogą działać dla różnych banków.

### Dopasowanie po fragmencie tekstu

```javascript
{
  match: [
    "LIDL",
    "REWE",
    "ALDI",
    "BIEDRONKA"
  ],
  direction: "expense",
  category: "Zakupy",
  subcategory: "Spożywcze",
},
```

### Pojedynczy tekst

```javascript
{
  match: "Telekom",
  direction: "expense",
  category: "Rachunki i media",
  subcategory: "Internet",
},
```

### RegExp

```javascript
{
  matchRegex: [
    /\bFestnetz\b/i
  ],
  direction: "expense",
  category: "Rachunki i media",
  subcategory: "Internet",
},
```

### Kierunek

Tylko wydatki:

```javascript
direction: "expense"
```

Tylko przychody:

```javascript
direction: "income"
```

Oba:

```javascript
direction: "both"
```

### Reguły zależne od banku

Każda transakcja posiada:

```javascript
transaction.sourceBank
```

Można więc rozszerzyć `findCategory()` o opcjonalne pole:

```javascript
bank: "mbank"
```

jeżeli potrzebne są reguły specyficzne dla jednego źródła.

## Zapobieganie duplikatom

Po poprawnym dodaniu transakcji jej identyfikator jest zapisywany w:

```text
data/imported.json
```

Przy kolejnych uruchomieniach importer pomija już zapisane identyfikatory.

Każdy parser powinien generować stabilne ID na podstawie danych źródłowych, np.:

- identyfikatora banku,
- daty,
- kwoty,
- waluty,
- kontrahenta,
- opisu lub referencji.

## Obsługa błędów

Importer zatrzymuje się przy pierwszym błędzie.

Błędy zapisywane są w:

```text
data/errors.json
```

Transakcja trafia do `data/imported.json` dopiero po pomyślnym zapisaniu jej w Kontomierzu.

Po poprawieniu błędu można ponownie uruchomić:

```bash
node src/index.js
```

## Kalendarz

Importer korzysta z elementów React Calendar:

```css
.react-calendar__navigation__label
.react-calendar__navigation__prev-button
.react-calendar__navigation__next-button
```

Dzień jest odnajdywany przez:

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

Dzięki temu importer może podczas jednego uruchomienia dodawać transakcje do wielu różnych portfeli.

## Kolejność importu

Transakcje ze wszystkich aktywnych źródeł są łączone do jednej listy i mogą być sortowane według:

1. daty,
2. źródła,
3. identyfikatora transakcji.

## Bezpieczeństwo

Zalecany `.gitignore`:

```gitignore
node_modules/

kontomierz-session.json

data/*.csv
data/imported.json
data/errors.json

.env
```

Nie publikuj plików CSV, danych rachunków ani `kontomierz-session.json`.

## Typowy workflow

Logowanie:

```bash
node src/login.js
```

Import:

```bash
node src/index.js
```

Po wygaśnięciu sesji:

```bash
node src/login.js
node src/index.js
```

## Testowanie nowego parsera

Najpierw:

```javascript
maxTransactions: 1
```

Sprawdź:

- datę,
- kwotę,
- walutę,
- przychód/wydatek,
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

Importer automatyzuje interfejs webowy Kontomierza. Zmiany w HTML Kontomierza, nazwach pól, dropdownach, przyciskach lub datepickerze mogą wymagać aktualizacji selektorów Playwright.

Parsery bankowe są niezależne od mechanizmu automatyzacji Kontomierza, dlatego zmiana formatu CSV jednego banku powinna wymagać aktualizacji wyłącznie parsera tego banku.
