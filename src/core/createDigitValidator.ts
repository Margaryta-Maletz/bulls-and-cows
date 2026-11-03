export function createDigitValidator(base: number): (char: string) => boolean {
  return (char: string) => {
    const digit = parseInt(char, base);
    return !isNaN(digit) && digit.toString(base) === char.toLowerCase();
  };
}
