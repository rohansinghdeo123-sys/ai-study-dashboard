import { describe, expect, it } from "vitest";
import { EMPTY_VALUE } from "@/lib/examConfig";
import {
  displayValue,
  formatLabel,
  getRecordEntries,
  toNumber,
} from "@/lib/format";

describe("format helpers", () => {
  it("parses finite numbers and falls back for unsafe values", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber("3.5")).toBe(3.5);
    expect(toNumber("not-a-number", 7)).toBe(7);
    expect(toNumber(Number.NaN, -1)).toBe(-1);
  });

  it("uses the shared empty value marker for blank display values", () => {
    expect(displayValue(null)).toBe(EMPTY_VALUE);
    expect(displayValue(undefined)).toBe(EMPTY_VALUE);
    expect(displayValue("")).toBe(EMPTY_VALUE);
    expect(displayValue(0)).toBe("0");
  });

  it("formats underscore labels for dashboard display", () => {
    expect(formatLabel("weak_area_score")).toBe("Weak Area Score");
    expect(formatLabel("api_llm_usage")).toBe("Api Llm Usage");
  });

  it("sorts record entries by numeric value descending", () => {
    expect(getRecordEntries({ chemistry: 7, physics: "12", biology: 3 })).toEqual([
      { key: "physics", value: "12" },
      { key: "chemistry", value: 7 },
      { key: "biology", value: 3 },
    ]);
    expect(getRecordEntries(undefined)).toEqual([]);
  });
});
