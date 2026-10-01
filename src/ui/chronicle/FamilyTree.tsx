import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameState } from "../../engine/engine.types";
import { personById } from "../../engine/persons";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { personEmblem } from "../persons/personModels";
import { portraitStyle } from "../portraitArt";
import { frameSafe } from "../frameBox";
import { FRAME_GAP } from "../frameTokens.generated";
import { wave25FrameStyle, wave25ImageStyle, wave25LineStyle } from "../wave25Art";
import { FAMILY_TREE_COPY } from "./familyTreeCopy.ko";
import { familyTreeView, TREE, type TreeJointKind } from "./familyTreeModel";

// UI-7 the biography's family tree (가계도 tab): the Wave 25 banner with the lineage's arms, the generation labels, the
// person frames (plain, selected, deceased; the outside-spouse marker on those married in), the branch lines, joints
// and marriage links, and a fold button on each unit with children (familyTreeModel.ts lays it out). The tree is never
// scaled down (its names and years stay at 13 / 12 px): it folds to the page's width, and scrolls beyond that. A frame
// opens that person.

const PORTRAIT = 64;
const JOINT_ART: Readonly<Record<TreeJointKind, Parameters<typeof wave25ImageStyle>[0]>> = {
  corner_tl: "tree_line_corner_tl", corner_tr: "tree_line_corner_tr", corner_bl: "tree_line_corner_bl", corner_br: "tree_line_corner_br",
  junction_t: "tree_line_junction_t", junction_t_up: "tree_line_junction_t",
};
const at = (x: number, y: number): CSSProperties => ({ position: "absolute", left: x, top: y });
/** UI-AUDIT-1: a generation label is as tall as its frame box around one 16 px line (`.family-tree-generation`), in the
 * label column left of the tree. */
const GENERATION_LABEL = (() => {
  const safe = frameSafe("tree-generation", 1);
  return { width: TREE.labelColumn - 8, height: safe.top + safe.bottom + 2 * FRAME_GAP + 16 };
})();

export function FamilyTree({ state, personId, onPerson }: { readonly state: GameState; readonly personId: string; readonly onPerson: (personId: string) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState({ width: 1000 });
  const [choices, setChoices] = useState<ReadonlyMap<string, boolean>>(new Map());
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return undefined;
    const measure = () => setRoom({ width: element.clientWidth });
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  // why: the tree reads the persons (time stands still while the chronicle is open); the fold choices and the width refold it
  const tree = useMemo(() => familyTreeView(state, personId, choices, room.width), [state.persons, personId, choices, room.width]); // eslint-disable-line react-hooks/exhaustive-deps
  // A tree wider than the page opens scrolled to the selected person (again when the selection moves to another tree).
  const selected = tree?.nodes.find(node => node.selected);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null || selected === undefined || tree === null || tree.width <= element.clientWidth) return;
    element.scrollLeft = Math.max(0, selected.x + TREE.nodeWidth / 2 - element.clientWidth / 2);
  // why: only on opening a person's tree, not on each fold (a fold keeps where the player scrolled)
  }, [personId, tree?.lineageId]); // eslint-disable-line react-hooks/exhaustive-deps
  const founder = tree === null ? undefined : personById(state, tree.emblemPersonId);
  const emblem = founder === undefined ? null : personEmblem(state, founder);
  const toggle = (unitId: string, open: boolean) => setChoices(previous => new Map(previous).set(unitId, !open));
  return (
    <div className="family-tree" ref={box} data-family-tree={tree?.lineageId ?? "none"}>
      {tree === null ? <p className="chronicle-empty">{FAMILY_TREE_COPY.empty}</p> : (
          <div className="family-tree-canvas" role="tree" aria-label={FAMILY_TREE_COPY.treeLabel(tree.nodes.find(node => node.selected)?.name ?? "")}
            data-nodes={tree.nodes.length} data-folded={tree.toggles.filter(entry => !entry.open).length}
            style={{ width: tree.width, height: tree.height }}>
            <div className="family-tree-plane" style={{ width: tree.width, height: tree.height }}>
              <div className="family-tree-banner" data-frame="tree-banner" style={{ ...at(tree.width / 2 - 170, 8), width: 340, height: 64, ...wave25FrameStyle("tree_lineage_banner", 1) }}>
                {emblem === null ? null : <EmblemImage emblem={emblem} size={40} label={tree.banner} />}
                <span className="family-tree-banner-text">{tree.banner}</span>
              </div>
              {tree.generations.map(row => (
                <span key={row.label} className="family-tree-generation" data-frame="tree-generation" style={{ ...at(4, row.y - GENERATION_LABEL.height / 2), ...GENERATION_LABEL, ...wave25FrameStyle("tree_generation_label", 1) }}>{row.label}</span>
              ))}
              {tree.lines.map((line, index) => (
                <span key={`l${index}`} className="family-tree-line" aria-hidden="true"
                  style={{ ...at(line.axis === "h" ? line.x : line.x - TREE.line / 2, line.axis === "h" ? line.y - TREE.line / 2 : line.y), ...wave25LineStyle(line.axis, line.length, TREE.line) }} />
              ))}
              {tree.joints.map((joint, index) => (
                <span key={`j${index}`} className={`family-tree-joint family-tree-joint--${joint.kind}`} aria-hidden="true"
                  style={{ ...at(joint.x - TREE.joint / 2, joint.y - TREE.joint / 2), ...wave25ImageStyle(JOINT_ART[joint.kind], TREE.joint) }} />
              ))}
              {tree.marriages.map((link, index) => (
                <span key={`m${index}`} className="family-tree-marriage" aria-hidden="true"
                  style={{ ...at(link.x - TREE.spouseGap / 2, link.y - 8), ...wave25ImageStyle("tree_marriage_link", TREE.spouseGap, 16) }} />
              ))}
              {tree.nodes.map(node => {
                const face = portraitStyle(node.portraitId, PORTRAIT);
                const frame = node.dead ? wave25FrameStyle("tree_node_frame_deceased", 0.6) : wave25FrameStyle(node.selected ? "tree_node_frame_selected" : "tree_node_frame", 0.6);
                return (
                  <Button key={node.personId} type="button" className="family-tree-node" data-frame="tree-node" role="treeitem" aria-label={node.label} aria-selected={node.selected}
                    data-person={node.personId} data-outside={node.outside ? "true" : undefined} data-dead={node.dead ? "true" : undefined}
                    style={{ ...at(node.x, node.y), width: TREE.nodeWidth, height: TREE.nodeHeight, ...frame }} onPress={() => onPerson(node.personId)} variant="quiet">
                    <span className={`family-tree-face${node.dead ? " portrait-greyscale" : ""}`} aria-hidden="true" style={face ?? { width: PORTRAIT, height: PORTRAIT }} />
                    {node.outside ? <span className="family-tree-outside" aria-hidden="true" style={wave25ImageStyle("tree_outside_spouse_marker", 20)} /> : null}
                    <span className="family-tree-name">{node.name}</span>
                    <span className="family-tree-years">{node.years}</span>
                    {node.deathCause === null ? null : <span className="family-tree-cause" aria-hidden="true">{FAMILY_TREE_COPY.plagueShort}</span>}
                  </Button>
                );
              })}
              {tree.toggles.map(entry => (
                <span key={`t${entry.unitId}`} className="family-tree-toggle-slot" style={at(entry.x - TREE.toggle / 2, entry.y - TREE.toggle / 2)}>
                  <Button type="button" className="family-tree-toggle" aria-label={entry.label} aria-expanded={entry.open} data-unit={entry.unitId}
                    onPress={() => toggle(entry.unitId, entry.open)} variant="quiet">
                    <span aria-hidden="true" style={wave25ImageStyle(entry.open ? "tree_collapse" : "tree_expand", 28)} />
                  </Button>
                  {entry.open ? null : <span className="family-tree-hidden">{FAMILY_TREE_COPY.hidden(entry.hidden)}</span>}
                </span>
              ))}
            </div>
          </div>
      )}
    </div>
  );
}
