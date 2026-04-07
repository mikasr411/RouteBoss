/** A, B, … Z, AA, AB … — visit order index on map + Routes */
export function routeVisitLetter(zeroBasedIndex: number): string {
  let i = zeroBasedIndex;
  let label = "";
  while (i >= 0) {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
}
