// The 95 % band of a paired comparison (perf:ab, the trend's A-B confirmation; decision RR7): Student's t by the number
// of pairs. ±2 standard errors is the many-pairs approximation; at 4 pairs (3 degrees of freedom) it is a band of about
// 80 %, at which identical code was confirmed worse or better in 3 of 20 verdicts.

/** Two-sided 95 % quantiles of Student's t by degrees of freedom (pairs − 1); past 30 the normal 1.96. */
const T95 = [Infinity, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export const t95 = (degrees: number): number => degrees < 1 ? Infinity : degrees < T95.length ? T95[degrees]! : 1.96;
