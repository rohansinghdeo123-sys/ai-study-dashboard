import { describe, expect, it } from "vitest";
import {
  normalizeSubscriptGlyphs,
  tokenizeStudyText,
} from "@/lib/studyChemistry";

describe("study chemistry text transforms", () => {
  it("normalizes unicode subscript glyphs for consistent parsing", () => {
    expect(normalizeSubscriptGlyphs("C\u2086H\u2081\u2082O\u2086")).toBe("C6H12O6");
    expect(normalizeSubscriptGlyphs("C\u2099H\u2082\u2099\u208A\u2082")).toBe("CnH2n+2");
  });

  it("tokenizes formulas, hybridization, and variable powers without losing text", () => {
    expect(tokenizeStudyText("Bonding in H2O uses sp3 orbitals and x^-2 terms.")).toEqual([
      { kind: "text", value: "Bonding in " },
      { kind: "formula", atoms: [{ symbol: "H", subscript: "2" }, { symbol: "O", subscript: "" }], superscript: "" },
      { kind: "text", value: " uses " },
      { kind: "hybridization", superscript: "3" },
      { kind: "text", value: " orbitals and " },
      { kind: "variable_power", value: "x", superscript: "-2" },
      { kind: "text", value: " terms." },
    ]);
  });

  it("leaves non-chemical words as text", () => {
    expect(tokenizeStudyText("Carbon and water are words here.")).toEqual([
      { kind: "text", value: "Carbon and water are words here." },
    ]);
  });
});
