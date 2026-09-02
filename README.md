# Kontomierz Transactions Import

A local Node.js application that imports bank transactions from CSV/TSV exports into Kontomierz by automating the Kontomierz web interface with Playwright.

The project is designed as a **multi-bank importer**: each bank has its own parser, while the import logic and Kontomierz automation are shared.

## Features

- Import transactions from multiple banks in one run
- Currently supported:
  - N26
  - mBank
  - Alior Bank
- Easy configuration of bank files and Kontomierz wallet names
- Separate parser for each bank
- Common internal transaction format
- Automatic transaction categorization
- Categories stored outside the source code
- Regex-based category matching
- Separate rules for expenses and income
- Duplicate prevention using persistent transaction IDs
- Stops safely when an import error occurs
- Optional safety limit for the number of transactions imported in one run
- Persistent Playwright login session
- Designed to be extended with additional banks

## How it works

```text
Bank CSV/TSV files
        |
        v
Bank-specific parsers
        |
        v
Common transaction format
        |
        v
Category matching
        |
        v
Kontomierz Playwright automation
        |
        v
Imported transactions
```

Each bank parser converts its own export format into the same internal transaction structure. The rest of the application does not need to know how a particular bank formats its CSV file.

## Requirements

- Node.js 18+ recommended
- npm
- A Kontomierz account
- Browser access to Kontomierz

## Installation

Clone the repository and install dependencies:

```bash
git clone <REPOSITORY_URL>
cd kontomierz-transactions-import
npm install
```

Install the Playwright browser if required:

```bash
npx playwright install chromium
```

## Project structure

```text
kontomierz-transactions-import/
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
├── data/
│   └── .gitkeep
├── examples/
│   └── categories.example.json
└── src/
    ├── config.js
    ├── parser.js
    ├── categories.js
    ├── kontomierz.js
    ├── login.js
    ├── index.js
    └── parsers/
        ├── common.js
        ├── n26.js
        ├── mbank.js
        └── aliorbank.js
```

## Configuration

Main configuration is stored in:

```text
src/config.js
```

Example:

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
  },
};
```

### Bank configuration

Each bank has:

- `enabled` — whether the bank should be imported
- `file` — path to the exported bank file
- `walletName` — Kontomierz wallet into which transactions are imported

For example:

```javascript
mbank: {
  enabled: true,
  file: path.join(ROOT, "data", "mbank.csv"),
  walletName: "mBank PLN",
}
```

You can disable a bank without removing its configuration:

```javascript
mbank: {
  enabled: false,
  file: path.join(ROOT, "data", "mbank.csv"),
  walletName: "mBank PLN",
}
```

Missing files are skipped instead of causing the whole import to fail.

## Bank export files

Put your private bank exports in:

```text
data/
```

For example:

```text
data/
├── n26.csv
├── mbank.csv
├── aliorbank.csv
└── categories.json
```

The `data/` directory is intentionally excluded from Git.

**Do not commit bank exports to the repository.**

Bank exports may contain:

- names
- addresses
- IBANs/account numbers
- transaction descriptions
- balances
- other personal financial information

## Login

The importer uses a persistent Playwright session.

Run:

```bash
node src/login.js
```

A browser window will open. Log in to Kontomierz manually.

After successful login, the session is saved to:

```text
kontomierz-session.json
```

The session file contains authentication state and must remain private.

It is ignored by Git.

If the session expires, run the login script again.

## Running the importer

After configuring the bank files and wallet names:

```bash
node src/index.js
```

The importer will:

1. Load enabled bank files
2. Parse transactions
3. Combine transactions from all enabled banks
4. Sort them
5. Check which transactions have already been imported
6. Match categories
7. Open Kontomierz
8. Add transactions one by one
9. Save successfully imported transaction IDs
10. Stop on the first import error

## Duplicate prevention

Imported transaction IDs are stored in:

```text
data/imported.json
```

Before importing a transaction, the application checks whether its ID is already present.

This makes it possible to run the importer repeatedly without intentionally importing the same transaction again.

The ID is generated by each bank parser from transaction data that should uniquely identify the transaction.

Because bank exports can vary, duplicate detection is not a substitute for checking the result in Kontomierz after an import.

## Error handling

When a transaction cannot be imported, the importer:

- prints the error
- stores the transaction and error message in `data/errors.json`
- stops the import at the first error

Already imported transactions remain recorded in `data/imported.json`.

This makes it possible to fix the problem and run the importer again without re-importing transactions that were already processed successfully.

## Safety limit

For testing, you can limit the number of transactions imported during a run:

```javascript
maxTransactions: 10,
```

To disable the limit:

```javascript
maxTransactions: null,
```

A small limit is recommended when testing changes to parsers, selectors, categories, or Kontomierz automation.

## Transaction format

All bank parsers convert their input into a common transaction structure.

Conceptually:

```javascript
{
  id: "...",
  sourceBank: "n26",
  bookingDate: "2026-08-31",
  amount: -25.50,
  currency: "EUR",
  partnerName: "Example Store",
  partnerIban: "...",
  paymentReference: "...",
  description: "...",
  direction: "expense",
  walletName: "N26 EUR"
}
```

Not every bank provides every field. The individual parsers normalize what is available.

The important part is that the Kontomierz import code can work with the same structure regardless of the source bank.

## Bank parsers

Bank-specific parsing code is located in:

```text
src/parsers/
```

### N26

```text
src/parsers/n26.js
```

The parser handles the N26 CSV export and extracts fields such as:

- booking date
- partner name
- transaction type
- payment reference
- amount
- currency

### mBank

```text
src/parsers/mbank.js
```

The mBank parser handles the tab-separated export format and extracts the transaction amount and currency from the corresponding amount field.

### Alior Bank

```text
src/parsers/aliorbank.js
```

The Alior Bank parser handles the tab-separated export and uses the account currency amount/currency fields as the primary transaction amount and currency.

## Adding another bank

To add another bank:

### 1. Create a parser

Add:

```text
src/parsers/mybank.js
```

Implement:

```javascript
async function parseMyBank(bankConfig) {
  // Read bankConfig.file
  // Parse the bank export
  // Return an array of normalized transactions
}

module.exports = { parseMyBank };
```

### 2. Register the parser

In `src/parser.js`:

```javascript
const { parseMyBank } = require("./parsers/mybank");

const PARSERS = {
  n26: parseN26,
  mbank: parseMbank,
  aliorbank: parseAliorBank,
  mybank: parseMyBank,
};
```

### 3. Add configuration

In `src/config.js`:

```javascript
mybank: {
  enabled: true,
  file: path.join(ROOT, "data", "mybank.csv"),
  walletName: "My Bank PLN",
},
```

The rest of the importer can remain unchanged.

## Categories

Category matching is implemented in:

```text
src/categories.js
```

The category definitions should be stored separately in:

```text
data/categories.json
```

A public example is provided in:

```text
examples/categories.example.json
```

Copy the example and customize it:

```bash
cp examples/categories.example.json data/categories.json
```

The real category file is ignored by Git.

### Plain text matching

A rule can contain a simple string:

```json
{
  "match": "LIDL",
  "direction": "expense",
  "category": "Zakupy",
  "subcategory": "Spożywcze"
}
```

It can also contain multiple strings:

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

Matching is case-insensitive.

### Regex matching

Regex rules use JSON objects because JavaScript regular expression literals cannot be stored directly in JSON:

```json
{
  "matchRegex": [
    {
      "pattern": "\b(LIDL|REWE|ALDI|Netto|EDEKA)\b",
      "flags": "i"
    }
  ],
  "direction": "expense",
  "category": "Zakupy",
  "subcategory": "Spożywcze"
}
```

Multiple alternatives should generally be combined into one regex when they represent the same category:

```text
\b(Shell|Aral|Orlen|BP|Agip|ENI)\b
```

Literal dots should be escaped when they are intended to match an actual dot:

```text
Pyszne\.pl
Netflix\.com
```

### Direction

A category rule can be limited to:

```text
expense
```

or:

```text
income
```

It can also apply to both:

```text
both
```

Example:

```json
{
  "matchRegex": [
    {
      "pattern": "\b(CELONIS)\b",
      "flags": "i"
    }
  ],
  "direction": "income",
  "category": "Przychód",
  "subcategory": "Pensja"
}
```

This prevents the same merchant text from accidentally assigning an income category to an expense or vice versa.

### Matching fields

Category matching can use transaction information such as:

- partner name
- payment reference
- description

The first matching rule wins.

Therefore, put more specific rules before broad rules when necessary.

## Kontomierz automation

The Kontomierz interaction is implemented in:

```text
src/kontomierz.js
```

The importer uses Playwright to interact with the web application.

The automation handles, among other things:

- wallet selection
- transaction direction
- date selection
- amount
- category
- subcategory
- transaction creation

The selectors are scoped where possible to the transaction form to reduce the risk of interacting with another element on the page.

Because this project automates a third-party web interface, changes to the Kontomierz frontend may require selector updates.

## Common utilities

Shared parsing functionality is located in:

```text
src/parsers/common.js
```

It contains reusable functionality such as:

- delimiter detection
- parsing delimited files
- locating header rows
- decimal number parsing
- date normalization
- whitespace cleanup
- transaction ID hashing

This avoids duplicating the same parsing logic across bank-specific parsers.

## Development and testing

When changing the parser or Playwright automation, use a small test batch first:

```javascript
maxTransactions: 1,
```

or:

```javascript
maxTransactions: 5,
```

Run:

```bash
node src/index.js
```

Review the transaction in Kontomierz before increasing the limit.

When changing category rules, verify the console output:

```text
Kategoria: Zakupy → Spożywcze [reguła: ...]
```

This shows which rule matched the transaction.

## Extensibility

The architecture is intentionally split into separate layers:

```text
Bank-specific parsing
        ↓
Normalized transaction model
        ↓
Category matching
        ↓
Kontomierz automation
```

This means new functionality can generally be added without modifying unrelated parts of the application.

Possible future extensions include:

- additional banks
- additional category rules
- dry-run mode
- more detailed import reports
- configurable transaction filtering
- automated tests for individual parsers

## Limitations

This project depends on the current Kontomierz web interface.

It does not use a documented public Kontomierz API. Playwright automation may stop working if the website changes its HTML structure, selectors, form behavior, or authentication flow.

Bank export formats can also change over time. If a bank changes its CSV/TSV format, the corresponding parser may need to be updated.

Always verify imported transactions in Kontomierz, especially after making changes to a parser or the automation code.

## Disclaimer

This project is an independent automation tool and is not affiliated with or endorsed by Kontomierz or the supported banks.

Use it at your own risk and verify imported financial data before relying on it.
