import { PAD_GLYPH_NAMES, type PadHintPart } from "./inputHintCopy.ko";
import { glyphsOf, padGlyphStyle, type PadGlyphId } from "./padGlyphs";

// INSTALL-23 ⑤: a pad glyph (an image with its accessible name, PAD_GLYPH_NAMES) and a hint line drawn with them —
// each part the glyphs of its controller actions, then its words. Not a control (no press, no hover).
export function PadGlyph({ glyph, size = 24 }: { readonly glyph: PadGlyphId; readonly size?: number }) {
  return <span className="pad-glyph" role="img" aria-label={PAD_GLYPH_NAMES[glyph]} data-pad-glyph={glyph} style={padGlyphStyle(glyph, size)} />;
}

export function PadHint({ parts, size = 24, className = "" }: { readonly parts: readonly PadHintPart[]; readonly size?: number; readonly className?: string }) {
  return (
    <span className={`pad-hint ${className}`} data-input-hint="gamepad">
      {parts.map((part, index) => (
        <span key={index} className="pad-hint-part">
          {glyphsOf(part.actions ?? []).map(glyph => <PadGlyph key={glyph} glyph={glyph} size={size} />)}
          {part.text === "" ? null : <span className="pad-hint-text">{part.text}</span>}
        </span>
      ))}
    </span>
  );
}
