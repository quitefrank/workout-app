/**
 * Shared helpers for the PDF programme converters. The Python extractor
 * (scripts/extract-pdf-tables.py) dumps each page's text lines and
 * tables; these turn table cells into contract values the way
 * ppl-sheet.ts does for the workbook.
 */

import { existsSync, readFileSync } from "node:fs";
import { doseFromSheet, type SheetDose } from "./ppl-sheet";
import { parseDose } from "../../src/lib/recovery/dose";

export { SUPERSET_RE } from "./ppl-sheet";

export type PdfPage = { page: number; text: string[]; tables: string[][][] };
export type PdfTables = { file: string; pages: PdfPage[] };

/** Read a dump written by scripts/extract-pdf-tables.py; throws with a hint when it is missing. */
export function loadPdfTables(path: string): PdfTables {
  if (!existsSync(path)) throw new Error(`${path} is missing; run \`bun run extract:pdfs\` first`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as PdfTables).pages)) {
    throw new Error(`${path}: expected {"file", "pages": [...]}`);
  }
  return raw as PdfTables;
}

/** Collapse a cell to one line; blanks, "-" and "N/A" are null. */
export function cellText(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
  if (t === "" || t === "-" || t.toUpperCase() === "N/A") return null;
  return t;
}

const KEEP_UPPER = new Set(["EZ", "DB", "BB", "RDL", "OHP", "GHR", "ROM", "AMRAP", "RPE"]);
const SMALL_WORDS = new Set(["or", "and", "w/", "to", "of", "the", "a", "with", "at", "in", "on", "for"]);

function capitalise(word: string): string {
  if (word === "") return word;
  const upper = word.toUpperCase();
  if (KEEP_UPPER.has(upper)) return upper;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Title-case an all-caps PDF name: each word and each hyphen, slash,
 * bracket, comma or colon part capitalised, known acronyms kept, small
 * words lowered after the first. Punctuation stays where it is.
 */
export function titleCaseName(raw: string): string {
  const words = (cellText(raw) ?? "").split(" ");
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return word
        .split(/([-/(),:])/)
        .map((part) => (/^[-/(),:]$/.test(part) ? part : capitalise(part)))
        .join("");
    })
    .join(" ");
}

/**
 * Sentence-case a shouted note: everything lowered, the first letter of
 * each sentence raised, known acronyms restored word by word. Null for
 * a blank cell.
 */
export function sentenceCase(raw: string | null | undefined): string | null {
  const t = cellText(raw);
  if (!t) return null;
  const lowered = t.toLowerCase().replace(/[a-z]+/g, (word) => (KEEP_UPPER.has(word.toUpperCase()) ? word.toUpperCase() : word));
  return lowered
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence[0].toUpperCase() + sentence.slice(1))
    .join(" ");
}

/** Rest as the seed's parseRestSeconds reads it: "~3-4 min", "0 min", "30 sec", "90 sec". */
export function restFromPdf(raw: string | null | undefined): string | null {
  const t = cellText(raw);
  if (!t) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)(?:\s*-\s*(\d+))?\s*min$/i.exec(t))) return m[2] ? `~${m[1]}-${m[2]} min` : `${m[1]} min`;
  if ((m = /^(\d+)\s*sec$/i.exec(t))) return `${m[1]} sec`;
  if ((m = /^\d+(?:\.\d+)?$/.exec(t))) {
    const minutes = Number(t);
    return Number.isInteger(minutes) ? `${minutes} min` : `${Math.round(minutes * 60)} sec`;
  }
  return t;
}

export type RpeCell = { rpe: string | null; loadNote: string | null };

/** An RPE cell that may hold a percentage of 1RM instead; the percentage becomes a note. */
export function percentOrRpe(raw: string | null | undefined): RpeCell {
  const t = cellText(raw);
  if (!t) return { rpe: null, loadNote: null };
  let m: RegExpExecArray | null;
  if ((m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*%$/.exec(t))) {
    const trim = (x: string) => String(Number(x));
    return { rpe: null, loadNote: `Load: ${trim(m[1])}${m[2] ? `-${trim(m[2])}` : ""}% 1RM` };
  }
  if (/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?$/.test(t)) return { rpe: t.replace(/\s+/g, ""), loadNote: null };
  return { rpe: null, loadNote: `RPE as written: ${t}` };
}

/**
 * Sets and reps cells to a parseDose string plus a note for what the
 * dose cannot carry (per side, each leg, a rep scheme, a test set).
 * Null when the pair cannot be dosed; the converter reports the row.
 */
export function doseFromPdf(setsCell: string | null | undefined, repsCell: string | null | undefined): SheetDose | null {
  const sets = (cellText(setsCell) ?? "").replace(/[^0-9-]/g, "");
  let reps = cellText(repsCell) ?? "";
  // "0 / 0" is how the arm programme writes an open-ended set; the
  // converter decides what to do with it, not the dose.
  if (/^0+$/.test(sets) || /^0+$/.test(reps)) return null;
  let note: string | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)\s*\/\s*(\d+)$/.exec(reps)) && m[1] === m[2]) {
    note = `${m[1]} per side`;
    reps = m[1];
  } else if ((m = /^(\d+)\s+(?:steps\s+)?each\s+(?:leg|side|arm)$/i.exec(reps))) {
    note = `As written: ${reps.toLowerCase()}`;
    reps = m[1];
  } else if (/^\d+(?:\s*\+\s*\d+)+$/.test(reps)) {
    const parts = reps.split("+").map((x) => Number(x.trim()));
    note = `Reps: ${parts.join(" + ")}`;
    reps = String(parts.reduce((a, b) => a + b, 0));
  } else if ((m = /^(\d+)\s*-\s*sec$/i.exec(reps))) {
    reps = `${m[1]}sec`;
  } else if (/^rpe\s*\d+\s*test$/i.test(reps)) {
    note = `As written: ${reps}`;
    reps = "1";
  }
  const sd = doseFromSheet(sets, reps);
  if (!sd || !parseDose(sd.dose)) return null;
  return { dose: sd.dose, note: [note, sd.note].filter(Boolean).join(". ") || null };
}
