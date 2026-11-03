import { describe, it, expect } from "vitest";
import { createDigitValidator } from "./createDigitValidator.js";

describe("createDigitValidator", () => {
  it("returns a function — это и есть каррирование", () => {
    const validate = createDigitValidator(10);
    expect(typeof validate).toBe("function");
  });

  it("десятичная (base 10): цифры 0–9 допустимы", () => {
    const isDecimal = createDigitValidator(10);
    expect(isDecimal("0")).toBe(true);
    expect(isDecimal("9")).toBe(true);
    expect(isDecimal("a")).toBe(false);
  });

  it("двоичная (base 2): только 0 и 1", () => {
    const isBinary = createDigitValidator(2);
    expect(isBinary("0")).toBe(true);
    expect(isBinary("1")).toBe(true);
    expect(isBinary("2")).toBe(false);
  });

  it("hex (base 16): a–f без учёта регистра", () => {
    const isHex = createDigitValidator(16);
    expect(isHex("a")).toBe(true);
    expect(isHex("A")).toBe(true); // верхний регистр — тоже валиден
    expect(isHex("f")).toBe(true);
    expect(isHex("F")).toBe(true);
    expect(isHex("g")).toBe(false);
  });
});
