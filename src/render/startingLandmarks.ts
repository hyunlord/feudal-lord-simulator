export type StartingLandmark = {
  readonly kind: "ford";
  readonly tx: number;
  readonly ty: number;
  readonly label: "나루터";
};

export const STARTING_LANDMARKS: readonly StartingLandmark[] = [
  { kind: "ford", tx: 53, ty: 41, label: "나루터" },
] as const;
