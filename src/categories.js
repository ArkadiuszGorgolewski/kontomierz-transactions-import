const fs = require("node:fs");
const config = require("./config");

function normalize(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadRules() {
  if (!fs.existsSync(config.categoriesFile)) {
    console.warn(
      `⚠ Brak pliku kategorii: ${config.categoriesFile}`
    );

    return [];
  }

  const content = fs.readFileSync(
    config.categoriesFile,
    "utf8"
  );

  const rules = JSON.parse(content);

  if (!Array.isArray(rules)) {
    throw new Error(
      "data/categories.json musi zawierać tablicę reguł."
    );
  }

  return rules;
}

function createRegex(regexConfig) {
  /*
   * Obsługujemy:
   *
   * {
   *   "pattern": "\\bFestnetz\\b",
   *   "flags": "i"
   * }
   *
   * albo prosty string:
   *
   * "\\bFestnetz\\b"
   */

  if (typeof regexConfig === "string") {
    return new RegExp(regexConfig, "i");
  }

  if (
    regexConfig &&
    typeof regexConfig.pattern === "string"
  ) {
    return new RegExp(
      regexConfig.pattern,
      regexConfig.flags || "i"
    );
  }

  return null;
}

const CATEGORY_RULES = loadRules();

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
     * Kierunek:
     *
     * expense
     * income
     * both
     */
    const ruleDirection =
      rule.direction || "both";

    if (
      ruleDirection !== "both" &&
      ruleDirection !== transaction.direction
    ) {
      continue;
    }

    /*
     * Opcjonalne ograniczenie reguły
     * do konkretnego banku.
     *
     * np.
     *
     * "bank": "mbank"
     */
    if (
      rule.bank &&
      rule.bank !== transaction.sourceBank
    ) {
      continue;
    }

    /*
     * Zwykłe dopasowanie fragmentu tekstu.
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
     * RegExp.
     */
    if (rule.matchRegex) {
      const regexConfigs =
        Array.isArray(rule.matchRegex)
          ? rule.matchRegex
          : [rule.matchRegex];

      for (const regexConfig of regexConfigs) {
        const regex =
          createRegex(regexConfig);

        if (!regex) {
          continue;
        }

        /*
         * Najpierw testujemy każde pole osobno.
         */
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

        /*
         * Następnie cały tekst.
         */
        regex.lastIndex = 0;

        if (regex.test(fields.join(" "))) {
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