# N26 → Kontomierz Importer

Importer transakcji z plików CSV eksportowanych z niemieckiego N26 do
Kontomierz.pl.

Program działa w Node.js i wykorzystuje Playwright do automatycznego
wprowadzania transakcji przez interfejs webowy Kontomierza. Nie korzysta
z API Kontomierza.

## Funkcje

-   import CSV z N26,
-   obsługa wydatków i przychodów,
-   automatyczny wybór portfela `N26 EUR`,
-   automatyczne ustawianie daty w kalendarzu,
-   obsługa polskiej i angielskiej lokalizacji kalendarza,
-   automatyczne przechodzenie między miesiącami,
-   mapowanie kontrahentów/opisów na kategorie i subkategorie,
-   osobne reguły kategorii dla przychodów i wydatków,
-   dopasowanie przez fragment tekstu lub RegExp,
-   zapamiętywanie już zaimportowanych transakcji,
-   zatrzymanie importu przy błędzie.

## Wymagania

-   macOS (projekt może działać również na innych systemach
    obsługiwanych przez Node.js i Playwright),
-   Node.js,
-   npm,
-   konto Kontomierz,
-   ręcznie utworzony portfel `N26 EUR` w Kontomierzu,
-   plik CSV wyeksportowany z N26.

Sprawdzenie Node.js:

``` bash
node -v
npm -v
```

## Instalacja

Utwórz katalog projektu:

``` bash
mkdir n26-kontomierz
cd n26-kontomierz
```

Zainicjuj projekt:

``` bash
npm init -y
```

Zainstaluj Playwright:

``` bash
npm install playwright
npx playwright install chromium
```

## Struktura projektu

``` text
n26-kontomierz/
├── package.json
├── package-lock.json
├── kontomierz-session.json
├── src/
│   ├── config.js
│   ├── parser.js
│   ├── categories.js
│   ├── kontomierz.js
│   ├── login.js
│   └── index.js
└── data/
    ├── transactions.csv
    ├── imported.json
    └── errors.json
```

`kontomierz-session.json`, `imported.json` i `errors.json` są tworzone
podczas działania programu.

## CSV z N26

Plik CSV należy umieścić jako:

``` text
data/transactions.csv
```

Importer jest przygotowany dla eksportu zawierającego kolumny:

``` text
Booking Date
Value Date
Partner Name
Partner Iban
Type
Payment Reference
Account Name
Amount (EUR)
Original Amount
Original Currency
Exchange Rate
```

Znak kwoty określa kierunek transakcji:

``` text
-50.94  → wydatek
2500.00 → przychód
```

Do pola kwoty w Kontomierzu wpisywana jest wartość bezwzględna, a typ
`Wydatek` lub `Przychód` wybierany jest osobno.

## Konfiguracja

Najważniejsze ustawienia znajdują się w:

``` text
src/config.js
```

Przykład:

``` javascript
module.exports = {
  accountName: "N26 EUR",
  kontomierzUrl: "https://app.kontomierz.pl/",
  headless: false,
  slowMo: 200,
  delay: 500,
  maxTransactions: 10,
};
```

### Limit transakcji

Podczas testów warto używać:

``` javascript
maxTransactions: 1,
```

lub:

``` javascript
maxTransactions: 10,
```

Aby importować wszystkie nowe transakcje:

``` javascript
maxTransactions: null,
```

## Logowanie do Kontomierza

Logowanie jest oddzielone od importu.

Uruchom:

``` bash
node src/login.js
```

Następnie:

1.  zaloguj się ręcznie w otwartym Chromium,
2.  poczekaj na załadowanie aplikacji Kontomierz,
3.  nie zamykaj przeglądarki,
4.  wróć do Terminala,
5.  naciśnij Enter.

Sesja zostanie zapisana w:

``` text
kontomierz-session.json
```

Plik zawiera dane uwierzytelniające sesji i nie powinien być
udostępniany ani dodawany do repozytorium.

Jeżeli sesja wygaśnie, ponownie wykonaj:

``` bash
node src/login.js
```

## Import

Po przygotowaniu CSV i aktywnej sesji:

``` bash
node src/index.js
```

Przykładowy log:

``` text
==========================
N26 → Kontomierz importer
==========================
Wykryty separator: ,
Do importu: 10
Aktualny URL: https://app.kontomierz.pl/finanse/
Sesja Kontomierza jest aktywna.

Dodaję: Telekom Deutschland GmbH — Festnetz
Data: 2026-06-03
Kwota: -50.94 EUR
Kalendarz pokazuje: August 2026
← poprzedni miesiąc
Kalendarz pokazuje: July 2026
← poprzedni miesiąc
Kalendarz pokazuje: June 2026
Szukam dnia: "June 3, 2026"
✓ Wybrano datę 2026-06-03
✓ Wybrano: Wydatek
✓ Wybrano portfel N26 EUR
✓ Dodano
```

## Kategorie

Reguły znajdują się w:

``` text
src/categories.js
```

### Dopasowanie po fragmencie tekstu

``` javascript
{
  match: ["LIDL", "REWE", "ALDI"],
  direction: "expense",
  category: "Żywność",
  subcategory: "Supermarkety",
},
```

`match` wykorzystuje dopasowanie częściowe, dlatego `LIDL` może pasować
np. do:

``` text
LIDL 2179
LIDL SAGT DANKE
Kartenzahlung LIDL München
```

### Pojedyncze dopasowanie

Można również użyć:

``` javascript
{
  match: "Telekom",
  direction: "expense",
  category: "Rachunki i media",
  subcategory: "Internet",
},
```

### RegExp

Dla bardziej skomplikowanych przypadków:

``` javascript
{
  matchRegex: [
    /\bFestnetz\b/i
  ],
  direction: "expense",
  category: "Rachunki i media",
  subcategory: "Internet",
},
```

Nie należy używać `^Festnetz`, jeśli `Festnetz` może występować w środku
opisu. `^` oznacza początek tekstu.

### Kierunek reguły

Tylko wydatki:

``` javascript
direction: "expense"
```

Tylko przychody:

``` javascript
direction: "income"
```

Oba kierunki:

``` javascript
direction: "both"
```

Jeżeli `direction` nie zostanie podany, reguła może domyślnie działać
dla obu kierunków (zależnie od implementacji `findCategory`).

## Zapobieganie duplikatom

Po poprawnym dodaniu transakcji jej identyfikator jest zapisywany w:

``` text
data/imported.json
```

Przy kolejnym uruchomieniu importer pomija znajdujące się tam
transakcje.

Dzięki temu można importować partiami:

``` javascript
maxTransactions: 10
```

a później:

``` javascript
maxTransactions: 50
```

i ostatecznie:

``` javascript
maxTransactions: null
```

Nie usuwaj `data/imported.json` po udanym imporcie, ponieważ program
może wtedy ponownie dodać wcześniejsze transakcje.

## Obsługa błędów

Importer zatrzymuje się przy pierwszym błędzie, aby uniknąć seryjnego
dodawania niepoprawnych transakcji.

Informacje o błędach zapisywane są w:

``` text
data/errors.json
```

Transakcja jest dodawana do `imported.json` dopiero po pomyślnym
zakończeniu importu.

## Kalendarz

Kontomierz korzysta z React Calendar.

Importer:

-   otwiera pole `input[name="date"]`,
-   odczytuje aktualnie wyświetlany miesiąc,
-   używa przycisków `.react-calendar__navigation__prev-button` i
    `.react-calendar__navigation__next-button`,
-   przechodzi do miesiąca transakcji,
-   znajduje dzień po `abbr[aria-label="..."]`,
-   klika nadrzędny przycisk dnia.

Obsługiwane są kalendarze z nazwami miesięcy po polsku i angielsku.

## Portfel

Dropdown portfela jest identyfikowany przez:

``` css
button[data-name="wallet"]
```

Po jego otwarciu importer wybiera portfel określony w:

``` javascript
accountName: "N26 EUR"
```

## Bezpieczeństwo

Nie umieszczaj w Git danych sesji ani danych bankowych.

Zalecany `.gitignore`:

``` gitignore
node_modules/
kontomierz-session.json
data/transactions.csv
data/imported.json
data/errors.json
.env
```

Szczególnie `kontomierz-session.json` może umożliwiać dostęp do aktywnej
sesji użytkownika.

## Typowy workflow

Pierwsze uruchomienie:

``` bash
node src/login.js
node src/index.js
```

Kolejne importy:

1.  pobierz nowy CSV z N26,
2.  zapisz go jako `data/transactions.csv`,
3.  uruchom:

``` bash
node src/index.js
```

Jeżeli pojawi się informacja o wygaśnięciu sesji:

``` bash
node src/login.js
node src/index.js
```

## Uwaga

Importer automatyzuje interfejs webowy Kontomierza. Zmiany w interfejsie
aplikacji mogą wymagać aktualizacji selektorów Playwright.

Przed dużym importem zalecane jest przetestowanie programu na kilku
transakcjach i zweryfikowanie poprawności dat, kwot, kierunków, portfela
oraz kategorii.
