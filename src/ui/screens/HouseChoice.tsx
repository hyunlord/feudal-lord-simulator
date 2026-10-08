import { useState } from "react";
import { Button } from "../kit";
import { EmblemImage } from "../heraldry/EmblemImage";
import { HOUSE_CHOICE_COPY as COPY } from "../houseChoiceCopy.ko";
import { ARMS_PAGE_SIZE, armsCandidates, chooseHouseName, houseArmsRecipe, houseNames, type HouseChoice } from "../houseChoice";

// LM-R3 (HOUSE-1, MNR-3): the welcome's step between the mode and the game — the twenty house names (the Korean
// reading, the period spelling small beside it), the chosen house's arms large, four drawn candidates side by side and
// "다른 문장 보기" for the next four. The names and the arms are equal choices (secondary); the start is the one primary.
// Every control isolates its press, so a choice never reaches the welcome's dismiss layer.
const ARMS_LARGE = 128;
const ARMS_CANDIDATE = 48;

export function HouseChoicePanel({ house, onHouse, onStart, onBack }: {
  readonly house: HouseChoice;
  readonly onHouse: (house: HouseChoice) => void;
  readonly onStart: () => void;
  readonly onBack: () => void;
}) {
  // The candidates' page; the chosen arms stay chosen on another page.
  const [page, setPage] = useState(0);
  const names = houseNames();
  const ko = names.find(entry => entry.name === house.name)?.ko ?? house.name;
  const pickName = (name: string) => {
    if (name === house.name) return;
    onHouse(chooseHouseName(name));
    setPage(0);
  };
  return (
    <div className="welcome-house" data-house={house.name} data-arms={house.arms}>
      <h2>{COPY.heading}</h2>
      <p>{COPY.line}</p>
      <div className="welcome-house-body">
        <div className="welcome-house-names" role="group" aria-label={COPY.namesLabel}>
          {names.map(entry => (
            <Button key={entry.name} className="welcome-house-name" type="button" variant="toggle" aria-pressed={entry.name === house.name}
              data-house-name={entry.name} isolate onPress={() => pickName(entry.name)}>
              <span className="welcome-house-name-ko">{entry.ko}</span>
              <small className="welcome-house-name-latin" lang="en">{entry.name}</small>
            </Button>
          ))}
        </div>
        <div className="welcome-house-arms" role="group" aria-label={COPY.armsLabel}>
          <div className="welcome-house-chosen">
            <EmblemImage emblem={{ kind: "arms", recipe: houseArmsRecipe(house.arms) }} size={ARMS_LARGE} label={COPY.arms(ko)} />
            <p className="welcome-house-chosen-name">{ko} <small lang="en">{house.name}</small></p>
          </div>
          <div className="welcome-house-candidates">
            {armsCandidates(house.name, page).map((arms, at) => (
              <Button key={arms} className="welcome-house-candidate" type="button" variant="toggle" aria-pressed={arms === house.arms}
                aria-label={COPY.candidate(ko, page * ARMS_PAGE_SIZE + at + 1)} data-arms-candidate={arms} isolate onPress={() => onHouse({ name: house.name, arms })}>
                <EmblemImage emblem={{ kind: "arms", recipe: houseArmsRecipe(arms) }} size={ARMS_CANDIDATE} label="" />
              </Button>
            ))}
          </div>
          <Button className="welcome-house-more" type="button" variant="secondary" isolate onPress={() => setPage(page + 1)}>
            {COPY.moreArms}
          </Button>
        </div>
      </div>
      <div className="welcome-house-actions">
        <Button className="autoplay-toggle save-control-button" type="button" variant="secondary" data-house-back isolate onPress={() => onBack()}>
          {COPY.back}
        </Button>
        <Button className="autoplay-toggle save-control-button" type="button" variant="primary" data-house-start isolate onPress={() => onStart()}>
          {COPY.start}
        </Button>
      </div>
    </div>
  );
}
