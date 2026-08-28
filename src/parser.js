const fs = require("node:fs");
const { parseN26 } = require("./parsers/n26");
const { parseMbank } = require("./parsers/mbank");
const { parseAliorBank } = require("./parsers/aliorbank");

const PARSERS = {
  n26: parseN26,
  mbank: parseMbank,
  aliorbank: parseAliorBank,
};

async function parseAllBanks(bankConfigs) {
  const allTransactions = [];
  const stats = [];

  for (const [bankKey, bankConfig] of Object.entries(bankConfigs)) {
    if (!bankConfig.enabled) {
      stats.push({ bankKey, status: "disabled", count: 0 });
      continue;
    }

    if (!fs.existsSync(bankConfig.file)) {
      console.log(`⚠ ${bankKey}: brak pliku ${bankConfig.file} — pomijam.`);
      stats.push({ bankKey, status: "missing", count: 0 });
      continue;
    }

    const parser = PARSERS[bankKey];

    if (!parser) {
      throw new Error(`Brak parsera dla banku: ${bankKey}`);
    }

    const transactions = await parser(bankConfig);

    console.log(
      `✓ ${bankKey}: ${transactions.length} transakcji → portfel "${bankConfig.walletName}"`
    );

    allTransactions.push(...transactions);
    stats.push({ bankKey, status: "ok", count: transactions.length });
  }

  // Stabilny porządek: najpierw data, potem bank, potem ID.
  allTransactions.sort((a, b) => {
    const byDate = a.bookingDate.localeCompare(b.bookingDate);
    if (byDate !== 0) return byDate;

    const byBank = a.sourceBank.localeCompare(b.sourceBank);
    if (byBank !== 0) return byBank;

    return a.id.localeCompare(b.id);
  });

  return { transactions: allTransactions, stats };
}

module.exports = {
  parseAllBanks,
};
