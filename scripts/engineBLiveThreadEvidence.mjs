const validTick = value => Number.isSafeInteger(value) && value >= 0;
const copy = value => structuredClone(value);

/** Inputs are same-tick canonical reads; chips must already pass the caller's exposure/hit test.
 * Membership follows c5d2b35 decisionReads.traceInRange and results/decisionThread.traceNews.
 * A thread chip is an indicator, never proof that the receipt's text was rendered automatically. */
export function createTraceThreadEvidence(answerId, answerTick, seasonLength) {
  if (typeof answerId !== 'string' || !answerId || !validTick(answerTick) || !Number.isSafeInteger(seasonLength) || seasonLength <= 0)
    throw new Error('Invalid trace-thread evidence contract');
  const firstSeen = new Map(), presentations = new Map(); let lastTick = answerTick;
  return {
    observe(observation, receipts) {
      const { tick, chips, traceRows, traceNews } = observation;
      if (!validTick(tick) || tick < lastTick) throw new Error('Trace-thread observation tick reversed or invalid');
      lastTick = tick;
      for (const chip of chips) if (typeof chip.chipId === 'string' && chip.visible !== false && !firstSeen.has(chip.chipId)) firstSeen.set(chip.chipId, tick);
      const season = Math.floor(tick / seasonLength), chipId = `trace:${answerId}:${season}`;
      const matches = chips.filter(chip => chip.chipId === chipId && chip.visible !== false);
      const news = traceNews.filter(row => row.decisionId === answerId);
      if (matches.length !== 1 || news.length !== 1 || typeof news[0].title !== 'string' || matches[0].text !== news[0].title
        || !Array.isArray(news[0].facts) || !news[0].facts.every(fact => typeof fact === 'string')) return;
      for (const receipt of receipts) {
        if (typeof receipt.id !== 'string' || !validTick(receipt.tick) || receipt.tick <= answerTick || receipt.tick > tick
          || Math.floor(receipt.tick / seasonLength) !== season || firstSeen.get(chipId) < receipt.tick) continue;
        const rows = traceRows.filter(row => row.recordId === receipt.id && row.tick === receipt.tick && row.decisionId === answerId
          && row.decisionTick === answerTick && typeof row.key === 'string' && row.key !== 'relation');
        for (const row of rows) {
          if (!(receipt.because ?? []).some(cause => cause.decisionId === answerId && cause.key === row.key)) continue;
          const identity = `${chipId}\0${receipt.id}\0${row.key}`;
          if (!presentations.has(identity)) presentations.set(identity, copy({ evidenceKind: 'trace-thread-indicator', receiptId: receipt.id,
            receiptTick: receipt.tick, observationTick: tick, firstSeenTick: firstSeen.get(chipId), chip: matches[0], sourceRow: row, news: news[0] }));
        }
      }
    },
    snapshot() { return { automaticThreadVisible: presentations.size > 0, threadPresentations: copy([...presentations.values()]) }; },
  };
}

/** Only a known informational report with one available normal Continue control may be dismissed. */
export function isInformationalSeasonLedger(panels) {
  if (!Array.isArray(panels) || panels.length !== 1) return false;
  const panel = panels[0];
  if (panel === null || typeof panel !== 'object') return false;
  const calendar = typeof panel.season === 'string' ? /^(\d+):([0-3])$/.exec(panel.season) : null;
  return panel.className === 'season-ledger-card' && calendar !== null && validTick(Number(calendar[1])) && panel.continueCount === 1 && panel.continueAvailable === true;
}
