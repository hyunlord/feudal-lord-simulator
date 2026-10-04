import type { ReactElement } from "react";

import { Button } from "../kit";
import { TUTORIAL_COPY } from "../tutorial/tutorialCopy.ko";
import { UiIcon } from "../UiIcon";
import { GOAL_PIN_COPY } from "./goalPinCopy.ko";
import type { ChapterFlow, GoalPin, GoalPinAction } from "./goalPinModel";

// LM-R1 (playtest 2026-10-02 #1, #10): the top of the goal log — the chapter's flow and the town's goal side by side,
// then the very next thing the town goal waits on with its one button. The finished goals fold under it (GoalDrawer).

export function GoalPinBlock({ pin, chapter, onAction }: {
  readonly pin: GoalPin | null; readonly chapter: ChapterFlow | null; readonly onAction: (action: GoalPinAction) => void;
}): ReactElement | null {
  if (pin === null && chapter === null) return null;
  const next = pin?.next ?? null;
  return (
    <section className="goal-pin" aria-label={GOAL_PIN_COPY.region}>
      <div className="goal-pin-columns">
        {chapter === null ? null : <div className="goal-pin-column goal-pin-chapter" data-chapter={chapter.number}>
          <h3>{GOAL_PIN_COPY.chapterHeading}</h3>
          <p className="goal-pin-title">{chapter.title}</p>
          <p>{chapter.goal}</p>
          <p className="goal-pin-count">{GOAL_PIN_COPY.chapterReached(chapter.reached, chapter.total)}</p>
          {pin === null ? null : <p className="goal-pin-apart">{GOAL_PIN_COPY.chapterApart}</p>}
        </div>}
        {pin === null ? null : <div className="goal-pin-column goal-pin-town">
          <h3>{GOAL_PIN_COPY.townHeading}</h3>
          <p className="goal-pin-title">{pin.title}</p>
          {pin.count === null ? null : <p className="goal-pin-count">{TUTORIAL_COPY.progress(pin.count.current, pin.count.target)}</p>}
        </div>}
      </div>
      {next === null ? null : <div className="goal-pin-next" data-goal-action={next.action.kind}>
        <p className="goal-pin-line">{next.line}</p>
        <Button type="button" className="goal-pin-cta" onPress={() => onAction(next.action)} variant="primary">
          <UiIcon sheet="action" cell="open" />{next.cta}</Button>
      </div>}
    </section>
  );
}
