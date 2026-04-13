/**
 * Round an amount based on decimal value.
 * If decimal < 0.5, round down (floor).
 * If decimal >= 0.5, round up (ceil).
 */
export const roundAmount = (value) => {
  if (value === null || value === undefined || value === "") return 0;

  const num = Number(value);
  if (isNaN(num)) return 0;

  // This is fundamentally what Math.round does for positive numbers.
  // We use the provided logic specifically for consistent behavior.
  const decimal = num - Math.floor(num);

  if (decimal < 0.5) {
    return Math.floor(num);
  } else {
    return Math.ceil(num);
  }
};
