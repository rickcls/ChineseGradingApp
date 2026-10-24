// OCR safety rail: an error that may come from a misread character must never
// become a student weakness. Vision-model OCR gives no per-character
// confidence, so we use two proxies:
//   1. an unresolved □ placeholder (the OCR could not read the character);
//   2. a character-level typo whose span still contains characters exactly as
//      the OCR produced them. Characters the student retyped while verifying
//      the transcript are their own writing and are trusted.

export const OCR_PLACEHOLDER = "□";

const OCR_PRONE_SUBCATEGORIES = new Set(["錯別字", "形近字", "同音字"]);

// LCS table budget (Uint16 cells). Larger middles are treated as unverified.
const MAX_DIFF_CELLS = 4_000_000;

type SuspectSource = "typed" | "photo" | "scan";

type ErrorSpan = {
  category: string;
  subcategory: string;
  char_offset_start: number;
  char_offset_end: number;
};

// mask[i] is true when verifiedText[i] is an OCR character the student left untouched.
export function ocrOriginMask(ocrText: string, verifiedText: string): boolean[] {
  const mask = new Array<boolean>(verifiedText.length).fill(false);

  let prefix = 0;
  const maxPrefix = Math.min(ocrText.length, verifiedText.length);
  while (prefix < maxPrefix && ocrText[prefix] === verifiedText[prefix]) {
    mask[prefix] = true;
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < maxPrefix - prefix &&
    ocrText[ocrText.length - 1 - suffix] === verifiedText[verifiedText.length - 1 - suffix]
  ) {
    mask[verifiedText.length - 1 - suffix] = true;
    suffix += 1;
  }

  const a = ocrText.slice(prefix, ocrText.length - suffix);
  const b = verifiedText.slice(prefix, verifiedText.length - suffix);
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return mask;

  if ((n + 1) * (m + 1) > MAX_DIFF_CELLS) {
    for (let j = 0; j < m; j += 1) mask[prefix + j] = true;
    return mask;
  }

  const width = m + 1;
  const dp = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      mask[prefix + j] = true;
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return mask;
}

export function buildOcrSuspectChecker(params: {
  source: SuspectSource;
  ocrText?: string | null;
  verifiedText: string;
}): (error: ErrorSpan) => boolean {
  const { source, verifiedText } = params;
  if (source === "typed") return () => false;

  // Without the original transcript we cannot tell what the student retyped.
  const mask = params.ocrText
    ? ocrOriginMask(params.ocrText, verifiedText)
    : new Array<boolean>(verifiedText.length).fill(true);

  return (error) => {
    const start = Math.max(0, error.char_offset_start);
    const end = Math.min(verifiedText.length, error.char_offset_end);
    if (end <= start) return false;

    const span = verifiedText.slice(start, end);
    if (span.includes(OCR_PLACEHOLDER)) return true;

    if (error.category !== "字詞" || !OCR_PRONE_SUBCATEGORIES.has(error.subcategory)) return false;
    for (let index = start; index < end; index += 1) {
      if (mask[index]) return true;
    }
    return false;
  };
}
