/**
 * FIX-7: the kill guard of a test that runs its check in a child `node --import tsx` process. It bounds a hang (an
 * unbounded loop never ends, so any bound catches it); it is not a time budget. The child's cold tsx start takes most
 * of a second on an idle machine and several on a loaded DGX, where the old 3 s guard failed once (CODE-1c listed it),
 * so the guard is generous: a child that finishes passes at once.
 */
export const CHILD_KILL_GUARD_MS = 60_000;
