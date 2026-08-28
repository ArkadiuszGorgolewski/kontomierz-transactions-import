# Aktualizacja: obsługa N26 + mBank + Alior Bank

Podmień w istniejącym projekcie:

- `src/config.js`
- `src/parser.js`
- `src/index.js`
- `src/kontomierz.js`

oraz dodaj katalog:

- `src/parsers/`

z plikami:

- `common.js`
- `n26.js`
- `mbank.js`
- `aliorbank.js`

Twoje istniejące `src/categories.js` oraz `src/login.js` zostają bez zmian.

## Pliki CSV

Umieść eksporty jako:

```text
data/n26.csv
data/mbank.csv
data/aliorbank.csv
```

Brakujący plik jest pomijany, więc nie musisz za każdym razem dostarczać eksportu ze wszystkich banków.

## Portfele Kontomierza

Nazwy portfeli ustawiasz w `src/config.js`:

```javascript
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
}
```

Nazwy muszą być identyczne z nazwami portfeli widocznymi w dropdownie Kontomierza.

## Import

```bash
node src/index.js
```

Program odczyta wszystkie włączone pliki, połączy transakcje, pominie identyfikatory znajdujące się już w `data/imported.json` i dla każdej transakcji wybierze właściwy portfel.

## Kategorie

Istniejące reguły `src/categories.js` nadal działają, ponieważ każdy parser tworzy wspólne pola:

- `partnerName`
- `paymentReference`
- `description`
- `direction`

Dzięki temu reguły mogą być wspólne dla wszystkich banków.

Możesz również w regule sprawdzać `transaction.sourceBank`, jeśli później zechcesz mieć reguły specyficzne dla banku.
