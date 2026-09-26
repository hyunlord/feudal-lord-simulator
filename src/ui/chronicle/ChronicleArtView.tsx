import { portraitStyle } from "../portraitArt";
import { wave16ImageStyle } from "../wave16Art";
import { wave17ImageStyle } from "../wave17Art";
import type { ChronicleArt } from "./chronicleScreenModel";

/** A record's picture: its Wave 16 / 17 illustration or the person's portrait, as a `size` px square. */
export function ChronicleArtView({ art, size, className }: { readonly art: ChronicleArt; readonly size: number; readonly className: string }) {
  if (art === null) return null;
  const style = art.kind === "wave16" ? wave16ImageStyle(art.id, size) : art.kind === "wave17" ? wave17ImageStyle(art.id, size) : portraitStyle(art.portraitId, size);
  if (style === null) return null;
  // A square slot: a wide event illustration is cropped to its middle.
  return <span className={`${className} ${className}--${art.kind}`} aria-hidden="true" style={{ ...style, height: size, backgroundPosition: "center" }} />;
}
