import type { ReactElement } from "react";

import type { GameState } from "../../../engine/engine.types";
import { platformServices } from "../../../platform/platform";
import { Button } from "../../kit";
import { UiIcon } from "../../UiIcon";
import { TOWN_CAMERA_COPY as COPY } from "./townCameraCopy.ko";
import { townSeatTile } from "./townSeat";

// DEC-CARD A2: "내 도시로" — the status pill's last cell in lord mode (LR1-D6: in the pill's cluster, no new HUD
// surface): the camera goes to the town's seat (townSeatTile), the same `lookAt` the cards' [위치로] sends.
export function TownSeatButton({ state }: { readonly state: GameState }): ReactElement | null {
  const seat = townSeatTile(state);
  if (seat === null) return null;
  return <Button type="button" className="status-pill-cell status-pill-town" data-town-seat={`${seat.tx},${seat.ty}`} aria-label={COPY.toTownLabel}
    onPress={() => platformServices().input.emit({ kind: "lookAt", tile: seat })} variant="surface">
    <UiIcon sheet="action" cell="look" />{COPY.toTown}
  </Button>;
}
