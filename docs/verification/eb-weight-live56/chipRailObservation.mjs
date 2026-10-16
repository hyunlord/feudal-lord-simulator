// Passive DOM evidence only: never advances clocks, answers, or changes state.
export async function observeChipRail(page, report, expectedId, label) {
  const sample = await page.evaluate(({ expectedId, label }) => {
    const describe = el => {
      const b = el.getBoundingClientRect(), style = getComputedStyle(el);
      const visible = b.width > 0 && b.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { id: el.getAttribute('data-chip-id'), story: el.getAttribute('data-story'), text: el.textContent?.trim(), visible,
        exposed: visible && b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight
          && top !== null && (el === top || el.contains(top)) };
    };
    return { tick: window.__FEUDAL_PHASE10_PROOF__.state().tick, label, expectedId,
      rail: [...document.querySelectorAll('.event-chip')].map(describe),
      completionNotices: [...document.querySelectorAll('.completion-toast')].map(describe).filter(row => row.visible) };
  }, { expectedId, label });
  const evidence = report.chipRailObservation ??= { samples: [], completionNotices: [], absenceIntervals: [],
    limit: 'Sampled DOM only; notice ticks are first-observed, not engine completion timestamps. No extra simulation for recovery.' };
  const previous = evidence.samples.at(-1);
  if (sample.completionNotices.length && (!previous?.completionNotices.length
    || JSON.stringify(previous.completionNotices) !== JSON.stringify(sample.completionNotices))) {
    evidence.completionNotices.push({ firstObservedTick: sample.tick, notices: sample.completionNotices });
  }
  const signature = row => JSON.stringify([row.expectedId, row.rail, row.completionNotices]);
  if (!previous || signature(previous) !== signature(sample)) evidence.samples.push(sample);
  evidence.lastObservedTick = sample.tick;
  const present = sample.rail.some(row => row.id === expectedId && row.visible && row.exposed);
  let interval = evidence.absenceIntervals.at(-1);
  if (!expectedId) {
    evidence.classification = evidence.absenceIntervals.some(row => row.endTick === null) ? 'unknown_open_interval' : 'unknown_no_current_target';
    return;
  }
  if (!present) {
    if (!interval || interval.endTick !== null || interval.expectedId !== expectedId) {
      interval = { expectedId, startTick: sample.tick, endTick: null, lastAbsentTick: sample.tick,
        precedingPresentTick: previous?.expectedId === expectedId && previous.rail.some(row => row.id === expectedId && row.exposed) ? previous.tick : null,
        noticeFirstObservedTick: evidence.completionNotices.at(-1)?.firstObservedTick ?? null,
        observedDurationTicks: 0, classification: 'unknown_open_interval' };
      evidence.absenceIntervals.push(interval);
    }
    interval.lastAbsentTick = sample.tick;
    interval.observedDurationTicks = sample.tick - interval.startTick;
    if (interval.observedDurationTicks > 10) interval.classification = 'persistent_observed_absence';
  } else if (interval?.endTick === null && interval.expectedId === expectedId) {
    interval.endTick = sample.tick;
    interval.observedDurationTicks = sample.tick - interval.startTick;
    const notice = interval.noticeFirstObservedTick;
    interval.classification = interval.precedingPresentTick !== null && notice !== null
      && interval.startTick >= notice && sample.tick - notice <= 10
      ? 'suspected_completion_flicker_observed_0_10_ticks'
      : interval.observedDurationTicks > 10 ? 'persistent_observed_absence' : 'unknown_closed_interval';
  }
  evidence.classification = evidence.absenceIntervals.some(row => row.classification === 'persistent_observed_absence')
    ? 'persistent_observed_absence'
    : evidence.absenceIntervals.length && evidence.absenceIntervals.every(row => row.classification === 'suspected_completion_flicker_observed_0_10_ticks')
      ? 'suspected_completion_flicker_observed_0_10_ticks'
      : evidence.absenceIntervals.length ? 'unknown' : 'no_observed_absence';
}
