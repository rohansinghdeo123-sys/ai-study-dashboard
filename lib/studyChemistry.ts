export interface ChemistryAtom {
  symbol: string;
  subscript: string;
}

export type StudyTextPart =
  | { kind: "text"; value: string }
  | { kind: "hybridization"; superscript: string }
  | { kind: "variable_power"; value: string; superscript: string }
  | { kind: "formula"; atoms: ChemistryAtom[]; superscript: string };

const CHEMICAL_ELEMENTS = new Set([
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr",
  "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba",
  "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W",
  "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U",
  "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt",
  "Ds", "Rg", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
]);

const CHEMICAL_ELEMENT_PATTERN = Array.from(CHEMICAL_ELEMENTS).sort((left, right) => right.length - left.length).join("|");
const NUMERIC_SUBSCRIPT_PATTERN = "(?:\\d+|[\\u2080-\\u2089]+)";
const ATOM_SUBSCRIPT_PATTERN = "(?:\\d*n(?:[+-]\\d+)?|n|\\d+|[\\u2080-\\u2089\\u2099\\u208A\\u208B]+)";
const ATOM_PATTERN = `(?:${CHEMICAL_ELEMENT_PATTERN})(?:${ATOM_SUBSCRIPT_PATTERN})?`;
const CHARGE_PATTERN = "(?:\\^[+-]?\\d+|\\^[+-])?";
const FORMULA_CANDIDATE = [
  "sp\\d+",
  "[a-zA-Z]\\^-?\\d+",
  `(?:${ATOM_PATTERN}){2,}${CHARGE_PATTERN}`,
  `(?:${CHEMICAL_ELEMENT_PATTERN})${NUMERIC_SUBSCRIPT_PATTERN}${CHARGE_PATTERN}`,
  `(?:${CHEMICAL_ELEMENT_PATTERN})(?:\\^[+-]?\\d+|\\^[+-])`,
].join("|");
const TOKEN_REGEX = new RegExp(`(?<![A-Za-z])(${FORMULA_CANDIDATE})(?![A-Za-z0-9\\u2080-\\u2089\\u2099\\u208A\\u208B^])`, "g");
const EXACT_TOKEN_REGEX = new RegExp(`^(?:${FORMULA_CANDIDATE})$`);
const ATOM_REGEX = new RegExp(`^(${CHEMICAL_ELEMENT_PATTERN})(\\d*n(?:[+-]\\d+)?|n|\\d+)?`);

const SUBSCRIPT_TEXT: Record<string, string> = {
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
  "\u2099": "n",
  "\u208A": "+",
  "\u208B": "-",
};

export function normalizeSubscriptGlyphs(value: string) {
  return value.replace(/[\u2080-\u2089\u2099\u208A\u208B]/g, (char) => SUBSCRIPT_TEXT[char] || char);
}

function parseStudyTextPart(piece: string): StudyTextPart {
  const normalizedPiece = normalizeSubscriptGlyphs(piece);
  const hybridization = normalizedPiece.match(/^sp(\d+)$/);
  if (hybridization) return { kind: "hybridization", superscript: hybridization[1] };

  const variablePower = normalizedPiece.match(/^([a-zA-Z])\^(-?\d+)$/);
  if (variablePower) {
    return { kind: "variable_power", value: variablePower[1], superscript: variablePower[2] };
  }

  const chargeMatch = normalizedPiece.match(/^(.+)\^([+-]?\d+|[+-])$/);
  const formula = chargeMatch ? chargeMatch[1] : normalizedPiece;
  const superscript = chargeMatch ? chargeMatch[2] : "";
  const atoms: ChemistryAtom[] = [];
  let cursor = 0;

  while (cursor < formula.length) {
    const match = formula.slice(cursor).match(ATOM_REGEX);
    if (!match || !CHEMICAL_ELEMENTS.has(match[1])) break;
    atoms.push({ symbol: match[1], subscript: match[2] || "" });
    cursor += match[0].length;
  }

  const hasSubscript = atoms.some((atom) => atom.subscript);
  if (cursor !== formula.length || !atoms.length || (atoms.length === 1 && !hasSubscript && !superscript)) {
    return { kind: "text", value: piece };
  }

  return { kind: "formula", atoms, superscript };
}

export function tokenizeStudyText(value: string): StudyTextPart[] {
  return value
    .split(TOKEN_REGEX)
    .filter(Boolean)
    .map((piece) => (EXACT_TOKEN_REGEX.test(piece) ? parseStudyTextPart(piece) : { kind: "text", value: piece }));
}
