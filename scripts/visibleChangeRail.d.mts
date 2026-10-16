export const FLICKER_TICKS: number;

type ToldEntry = { readonly tick: number; readonly at: number; readonly cls: string; readonly text: string; readonly id?: string | null; readonly gone?: boolean };
type Flicker = { readonly tick: number; readonly back: number; readonly rail: readonly string[]; readonly shown: readonly string[] };
type Push = { readonly tick: number; readonly by: readonly string[] };

export function railReport(told: readonly ToldEntry[]): {
  readonly flickers: number; readonly resultsPushedByPlain: number; readonly resultsPushedByHeld: number; readonly seenAgainAfterAYear: number;
  readonly flickerList: readonly Flicker[]; readonly pushed: { readonly plain: readonly Push[]; readonly held: readonly Push[] };
  readonly seenAgain: readonly { readonly id: string; readonly tick: number; readonly goneAt: number }[];
};
