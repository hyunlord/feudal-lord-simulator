import { EmblemImage } from "../heraldry/EmblemImage";
import { portraitStyle } from "../portraitArt";
import { wave16ImageStyle } from "../wave16Art";
import { wave17ImageStyle } from "../wave17Art";
import { wave21ImageStyle } from "../wave21Art";
import { wave31ImageStyle } from "../wave31Art";
import { wave33ImageStyle } from "../wave33Art";
import type { ChronicleArt } from "./chronicleScreenModel";

/** A record's picture: its Wave 16 / 17 illustration, the person's portrait or (UI-6) a faction's or a house's arms, as a `size` px square. */
export function ChronicleArtView({ art, size, className }: { readonly art: ChronicleArt; readonly size: number; readonly className: string }) {
  if (art === null) return null;
  if (art.kind === "emblem") {
    return <span className={`${className} ${className}--emblem`} aria-hidden="true" style={{ width: size, height: size }}><EmblemImage emblem={art.emblem} size={size} label="" /></span>;
  }
  const style = art.kind === "wave16" ? wave16ImageStyle(art.id, size) : art.kind === "wave17" ? wave17ImageStyle(art.id, size)
    : art.kind === "wave21" ? wave21ImageStyle(art.id, size) : art.kind === "wave31" ? wave31ImageStyle(art.id, size)
    : art.kind === "wave33" ? wave33ImageStyle(art.id, size) : portraitStyle(art.portraitId, size);
  if (style === null) return null;
  // A square slot: a wide event illustration is cropped to its middle.
  return <span className={`${className} ${className}--${art.kind}`} aria-hidden="true" style={{ ...style, height: size, backgroundPosition: "center" }} />;
}
