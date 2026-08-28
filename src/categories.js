const CATEGORY_RULES = [
    {
        matchRegex: [
            /\bLIDL\b/i,
            /\bREWE\b/i,
            /\bALDI\b/i,
            /\bNetto\b/i,
            /\bEDEKA\b/i,
            /\bAlnatura\b/i,
            /\bDM\b/i,
            /\bRossman\b/i,
            /\bDINO\b/i,
            /\bFELONA\b/i,
            /\bBiedronka\b/i,
            /\bKONZUM\b/i,
            /\bBILLA\b/i,
            /\bRossman\b/i,
            /\bErdbeerlang\b/i,
            /\bBackstube\b/i,
            /\bCENTRUM HANDLOWE\b/i,
            /\bZABKA\b/i,
        ],
        direction: "expense",
        category: "Zakupy",
        subcategory: "Spożywcze"
    },
    {
        matchRegex: [
            /\bE.ON\b/i
        ],
        direction: "expense",
        category: "Rachunki i media",
        subcategory: "Prąd"
    },
    {
        matchRegex: [
            /\bFestnetz\b/i
        ],
        direction: "expense",
        category: "Rachunki i media",
        subcategory: "Internet"
    },
    {
        matchRegex: [
            /\bTELEKOM DEUTSCHLAND\b/i
        ],
        direction: "expense",
        category: "Rachunki i media",
        subcategory: "Komórka"
    },
    {
        matchRegex: [
            /\bARD, ZDF\b/i
        ],
        direction: "expense",
        category: "Rachunki i media",
        subcategory: "RTV, Abonament"
    },
    {
        matchRegex: [
            /\bOBJEKT SONDERGEBIET\b/i
        ],
        direction: "expense",
        category: "Rachunki i media",
        subcategory: "Czynsz i wynajem"
    },
    {
        matchRegex: [
            /\bePARK\b/i,
            /\bparking\b/i
        ],
        direction: "expense",
        category: "Osobiste i rozrywka",
        subcategory: "Parkingi"
    },
    {
        matchRegex: [
            /\bIntegra\b/i,
        ],
        direction: "expense",
        category: "Dziecko",
        subcategory: "Dziecko - Edukacja"
    },

    {
        matchRegex: [
            /\bLieferando\b/i,
            /\bPyszne.pl\b/i,
            /\bRistorante\b/i,
            /\bgastronomie\b/i,
            /\bcukiernia\b/i
        ],
        direction: "expense",
        category: "Zakupy",
        subcategory: "Restauracja, Kawiarnia"
    },
    {
        matchRegex: [
            /\bShell\b/i,
            /\bAral\b/i,
            /\bOrlen\b/i,
            /\bBP\b/i,
            /\bBavaria\b/i,
            /\bAgip\b/i,
            /\bENI\b/i,
            /\bMOYA\b/i,
            /\bCircle\b/i,
            /\bSTACJA PALIW\b/i
            
        ], direction: "expense",
        category: "Samochód",
        subcategory: "Paliwo",
    },
    {
        matchRegex: [
            /\bTÜV SÜD\b/i,
            /\bBundeskasse\b/i,
            /\bAllianz\b/i
        ],
        direction: "expense",
        category: "Samochód",
        subcategory: "Opłaty i ubezpieczenie"
    },
    {
        matchRegex: [
            /\bMYJNIA PILAREK\b/i
        ],
        direction: "expense",
        category: "Samochód",
        subcategory: "Inne (konserwacja, dodatki)"
    },
    {
        matchRegex: [
            /\bAutodoc\b/i,
            /\biparts\b/i
        ],
        direction: "expense",
        category: "Samochód",
        subcategory: "Serwis i części"
    },
    {
        matchRegex: [
            /\bNetflix.com\b/i,
            /\bSpotify\b/i,
            /\bpatronite\b/i,
            /\bCHATGPT\b/i,

        ], direction: "expense",
        category: "Osobiste i rozrywka",
        subcategory: "Subskrypcje, film, muzyka, oprogramowanie, książki",
    },
    {
        matchRegex: [
            /\bAMZN\b/i,
            /\bAmazon\b/i,
            /\bAllegro\b/i
        ], direction: "expense",
        category: "Osobiste i rozrywka",
        subcategory: "Inne osobiste",
    },
    {
        matchRegex: [
            /\bCamping\b/i,
            /\bObelink\b/i
        ], direction: "expense",
        category: "Wakacje i wyjazdy",
        subcategory: "Przyczepa",
    },
    {
        matchRegex: [
            /\bCELONIS\b/i
        ], direction: "income",
        category: "Przychód",
        subcategory: "Pensja",
    },
];

/*
 * Normalizacja tekstu:
 * - duże litery
 * - usunięcie nadmiarowych spacji
 */
function normalize(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

function findCategory(transaction) {
  const fields = [
    transaction.partnerName,
    transaction.paymentReference,
    transaction.description,
  ]
    .filter(Boolean)
    .map(value => String(value).trim());

  const haystack = normalize(
    fields.join(" ")
  );

  for (const rule of CATEGORY_RULES) {
    /*
     * Najpierw sprawdzamy kierunek transakcji.
     */
    const ruleDirection =
      rule.direction || "both";

    const directionMatches =
      ruleDirection === "both" ||
      ruleDirection === transaction.direction;

    if (!directionMatches) {
      continue;
    }

    /*
     * Zwykłe dopasowanie tekstowe.
     */
    if (rule.match) {
      const matches = Array.isArray(rule.match)
        ? rule.match
        : [rule.match];

      for (const phrase of matches) {
        if (!phrase) {
          continue;
        }

        if (
          haystack.includes(
            normalize(phrase)
          )
        ) {
          return {
            category: rule.category,
            subcategory:
              rule.subcategory || null,
            matchedBy: String(phrase),
            direction: ruleDirection,
          };
        }
      }
    }

    /*
     * Regex.
     */
    if (rule.matchRegex) {
      const regexes =
        Array.isArray(rule.matchRegex)
          ? rule.matchRegex
          : [rule.matchRegex];

      for (const regex of regexes) {
        if (!(regex instanceof RegExp)) {
          continue;
        }

        for (const field of fields) {
          regex.lastIndex = 0;

          if (regex.test(field)) {
            return {
              category: rule.category,
              subcategory:
                rule.subcategory || null,
              matchedBy:
                regex.toString(),
              direction:
                ruleDirection,
            };
          }
        }

        regex.lastIndex = 0;

        if (
          regex.test(fields.join(" "))
        ) {
          return {
            category: rule.category,
            subcategory:
              rule.subcategory || null,
            matchedBy:
              regex.toString(),
            direction:
              ruleDirection,
          };
        }
      }
    }
  }

  return {
    category: null,
    subcategory: null,
    matchedBy: null,
    direction: null,
  };
}

module.exports = {
    findCategory,
};