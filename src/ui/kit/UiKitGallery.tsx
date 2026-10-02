import { useState } from "react";

import { UiIcon } from "../UiIcon";
import { Button, IconButton, type ButtonSize, type ButtonVariant } from "./Button";
import { Checkbox, Chip, Divider, Slider, Tabs, Toggle, Tooltip } from "./Controls";
import { Card, Panel, type FrameKind } from "./Frame";
import { NumberField } from "./NumberField";
import { Select } from "./Select";
import { UI_KIT_GALLERY_COPY as COPY } from "./uiKitGalleryCopy.ko";
import { PersonChip, PersonPortrait } from "../persons/PersonViews";
import { PERSON_STATE_COPY } from "../persons/personStateCopy.ko";
import { PERSON_STATES, type PersonStateId } from "../persons/personStates";
import { INPUT_HINT_COPY, PAD_GLYPH_NAMES, PAD_HINT_COPY } from "../inputHintCopy.ko";
import { PadGlyph, PadHint } from "../PadGlyph";
import type { PadGlyphId } from "../padGlyphs";

/**
 * UI-KIT-1 gallery (`/dev/ui-kit`): every kit part in every variant and state on one page, inside `.app-shell` so the
 * game's skin, type and touch floor apply. Desktop and tablet captures of it are gate ③ (scripts/uiSkinAudit.mjs).
 */
const VARIANTS: readonly Exclude<ButtonVariant, "icon">[] = ["primary", "secondary", "quiet", "danger", "toggle", "tab", "surface"];
const SIZES: readonly ButtonSize[] = ["sm", "md", "lg"];
const FRAMES: readonly FrameKind[] = ["light", "dark", "objective", "advisor", "modal", "tooltip", "record"];
/** INSTALL-23 ④: a pool face for each state's sample (the artist's proof faces; an adult for the parent's child_born). */
const STATE_FACES: Readonly<Record<PersonStateId, string>> = {
  mourning: "P06", sick: "P03", pregnant: "P02", child_born: "P07", dead: "I047_old", hunger: "P01",
  injury: "P04", pilgrim: "I056_mature", marriage: "P05", reeve: "I039_mature", bailiff: "I041_young", steward: "I042_mature",
};
const PAD_GLYPHS = Object.keys(PAD_GLYPH_NAMES) as PadGlyphId[];

/** INSTALL-23 ④ ⑤: the person-state ornaments on portraits (all twelve, each derived from the engine since UI-7) and the pad glyphs. */
function PersonStateAndPadSections() {
  return (
    <>
      <Panel className="ui-kit-gallery-section" aria-label={PERSON_STATE_COPY.gallerySection} data-section="person-states">
        <h2>{PERSON_STATE_COPY.gallerySection}</h2>
        <p>{PERSON_STATE_COPY.galleryNote}</p>
        <ul className="ui-kit-gallery-states">
          {PERSON_STATES.map(state => (
            <li key={state} data-person-state={state} data-derived="true">
              <strong>{PERSON_STATE_COPY.label(state)}</strong>
              <span className="ui-kit-gallery-state-faces">
                <PersonPortrait portraitId={STATE_FACES[state]} size={96} ornament={state} />
                <PersonPortrait portraitId={STATE_FACES[state]} size={48} ornament={state} />
              </span>
              <small>{PERSON_STATE_COPY.galleryEngine}</small>
            </li>
          ))}
        </ul>
        <div className="ui-kit-gallery-row">
          <PersonChip row={{ id: "p-gallery", name: PERSON_STATE_COPY.galleryChipName, line: PERSON_STATE_COPY.galleryChipLine, portraitId: STATE_FACES.child_born,
            exact: true, ornament: "child_born" }} onOpen={() => undefined} />
        </div>
      </Panel>
      <Panel className="ui-kit-gallery-section" aria-label={COPY.padSection} data-section="pad-glyphs">
        <h2>{COPY.padSection}</h2>
        <p>{COPY.padNote}</p>
        <ul className="ui-kit-gallery-pads">
          {PAD_GLYPHS.map(glyph => (
            <li key={glyph}><PadGlyph glyph={glyph} size={48} /><PadGlyph glyph={glyph} size={32} /><small>{PAD_GLYPH_NAMES[glyph]}</small></li>
          ))}
        </ul>
        <dl className="ui-kit-gallery-hints">
          <dt>{COPY.padKeyboard}</dt><dd data-input-hint="keyboard">{INPUT_HINT_COPY.mouse}</dd>
          <dt>{COPY.padGamepad}</dt><dd><PadHint parts={PAD_HINT_COPY.build} /></dd>
        </dl>
      </Panel>
    </>
  );
}

export function UiKitGallery() {
  const [severity, setSeverity] = useState(2);
  const [sound, setSound] = useState(true);
  const [seasonCard, setSeasonCard] = useState(false);
  const [volume, setVolume] = useState(70);
  const [digits, setDigits] = useState("482913");
  const [tab, setTab] = useState<"resources" | "view" | "map">("resources");
  const [pressed, setPressed] = useState(true);
  return (
    <div className="app-shell ui-kit-gallery" data-testid="ui-kit-gallery">
      <header className="ui-kit-gallery-head">
        <h1>{COPY.title}</h1>
        <p>{COPY.note}</p>
      </header>
      <Panel className="ui-kit-gallery-section" aria-label={COPY.sections.buttons} data-section="buttons">
        <h2>{COPY.sections.buttons}</h2>
        <div className="ui-kit-gallery-row">
          {VARIANTS.map(variant => (
            <Button key={variant} variant={variant} size="md" data-variant={variant}>{COPY.variants[variant]}</Button>
          ))}
        </div>
        <h3>{COPY.sections.sizes}</h3>
        <div className="ui-kit-gallery-row">
          {SIZES.map(size => <Button key={size} variant="primary" size={size} data-size={size}>{COPY.sizes[size]}</Button>)}
          {SIZES.map(size => <Button key={`s-${size}`} variant="secondary" size={size}>{COPY.sizes[size]}</Button>)}
        </div>
        <h3>{COPY.sections.states}</h3>
        {(["primary", "secondary", "toggle", "tab"] as const).map(variant => (
          <div key={variant} className="ui-kit-gallery-row" data-states={variant}>
            <Button variant={variant} size="md">{COPY.states.normal}</Button>
            <Button variant={variant} size="md" aria-pressed={pressed} {...(variant === "tab" ? { "aria-selected": true } : {})}
              onPress={() => setPressed(value => !value)}>{COPY.states.pressed}</Button>
            <Button variant={variant} size="md" disabled>{COPY.states.disabled}</Button>
          </div>
        ))}
        <h3>{COPY.sections.icon}</h3>
        <div className="ui-kit-gallery-row">
          <IconButton label={COPY.iconLabels.close}><UiIcon sheet="lock" cell="locked" /></IconButton>
          <IconButton label={COPY.iconLabels.look}><UiIcon sheet="action" cell="look" /></IconButton>
          <IconButton label={COPY.iconLabels.help}><UiIcon sheet="lock" cell="help" /></IconButton>
          <IconButton label={COPY.iconLabels.help} disabled><UiIcon sheet="lock" cell="help" /></IconButton>
        </div>
      </Panel>
      <Panel className="ui-kit-gallery-section" aria-label={COPY.sections.select} data-section="controls">
        <h2>{COPY.sections.select}</h2>
        <div className="ui-kit-gallery-row ui-kit-gallery-row--select">
          <Select label={COPY.selectLabel} value={severity} options={COPY.selectOptions.map((label, value) => ({ value, label }))} onChange={setSeverity} />
          <Select label={COPY.selectLabel} value={severity} options={COPY.selectOptions.map((label, value) => ({ value, label }))} onChange={setSeverity} disabled />
        </div>
        <h2>{COPY.sections.toggles}</h2>
        <div className="ui-kit-gallery-row">
          <Toggle checked={sound} label={`${COPY.toggle} ${sound ? COPY.on : COPY.off}`} onChange={setSound} />
          <Toggle checked={!sound} label={`${COPY.toggle} ${!sound ? COPY.on : COPY.off}`} onChange={value => setSound(!value)} />
          <Checkbox checked={seasonCard} label={COPY.checkbox} onChange={setSeasonCard} />
          <Checkbox checked={!seasonCard} label={COPY.checkbox} onChange={value => setSeasonCard(!value)} />
        </div>
        <h2>{COPY.sections.slider}</h2>
        <div className="ui-kit-gallery-row">
          <span>{COPY.slider(volume)}</span>
          <Slider min={0} max={100} step={10} value={volume} label={COPY.sliderLabel} valueText={COPY.slider(volume)} onChange={setVolume} />
          <Slider min={0} max={100} step={10} value={30} label={COPY.sliderLabel} onChange={() => undefined} disabled />
        </div>
        <h2>{COPY.sections.number}</h2>
        <p>{COPY.numberNote}</p>
        <div className="ui-kit-gallery-row" data-states="number">
          <NumberField label={COPY.numberLabel} value={digits} maxDigits={6} onChange={setDigits} />
          <NumberField label={COPY.numberInvalid} value="0" maxDigits={6} invalid onChange={() => undefined} />
          <NumberField label={COPY.numberLabel} value="1" maxDigits={6} disabled onChange={() => undefined} />
        </div>
        <h2>{COPY.sections.tabs}</h2>
        <Tabs label={COPY.sections.tabs} selected={tab} onSelect={setTab}
          tabs={(Object.keys(COPY.tabs) as (keyof typeof COPY.tabs)[]).map(key => ({ key, label: COPY.tabs[key] }))} />
        <h2>{COPY.sections.chips}</h2>
        <div className="ui-kit-gallery-row">
          <Chip>{COPY.chips.info}</Chip>
          {(["ok", "warn", "block", "info"] as const).map(tone => <Chip key={tone} tone={tone}>{COPY.chips[tone]}</Chip>)}
        </div>
      </Panel>
      <PersonStateAndPadSections />
      <section className="ui-kit-gallery-section ui-kit-gallery-frames" aria-label={COPY.sections.frames} data-section="frames">
        <h2>{COPY.sections.frames}</h2>
        <div className="ui-kit-gallery-grid">
          {FRAMES.map(kind => (
            <Card key={kind} as="div" kind={kind} className="ui-kit-gallery-frame" data-frame={kind}>
              <strong>{COPY.frames[kind]}</strong><p>{COPY.frameBody}</p>
            </Card>
          ))}
          <Card as="div" kind="objective" state="complete" className="ui-kit-gallery-frame"><strong>{COPY.frameStates.complete}</strong><p>{COPY.frameBody}</p></Card>
          <Card as="div" kind="objective" state="warn" className="ui-kit-gallery-frame"><strong>{COPY.frameStates.warn}</strong><p>{COPY.frameBody}</p></Card>
          <Card as="div" kind="advisor" state="warn" className="ui-kit-gallery-frame"><strong>{COPY.frameStates.advisorWarn}</strong><p>{COPY.frameBody}</p></Card>
        </div>
        <h2>{COPY.sections.tooltip}</h2>
        <Tooltip>{COPY.tooltip}</Tooltip>
        <Divider />
        <Panel kind="dark" className="ui-kit-gallery-dark">
          <Button variant="surface" tone="dark">{COPY.variants.surface}</Button>
          <Button variant="quiet" tone="dark">{COPY.variants.quiet}</Button>
          <Divider tone="dark" />
        </Panel>
      </section>
    </div>
  );
}
