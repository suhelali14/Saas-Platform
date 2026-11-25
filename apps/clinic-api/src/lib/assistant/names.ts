/**
 * A name as it sounds, not as it is spelt.
 *
 * A name said aloud reaches the assistant through a speech engine, which
 * spells it however it likes: the patient on file is "Fatima Sayyed" and
 * what arrives is "Fatima Syed", "Fatema Saiyad" or "फातिमा सय्यद". A
 * search that needs the letters to agree finds nobody, and the doctor is
 * told to check a spelling they never typed.
 *
 * So a name is reduced to the sounds that survive every spelling of it:
 * its consonants, in order, with the pairs that are one sound in an
 * Indian name written as one (ph and f, sh and s, z and j, w and v).
 * "Sayyed", "Syed" and "सय्यद" all come out as "sd".
 *
 * Pure, and tested against real pairs. It decides who is LISTED, never
 * what is changed: opening a file harms nobody, and anything that writes
 * to it still shows the patient's full name on a card first.
 */

const CONSONANTS: Record<string, string> = {
  क: "k", ख: "k", ग: "g", घ: "g", ङ: "n",
  च: "c", छ: "c", ज: "j", झ: "j", ञ: "n",
  ट: "t", ठ: "t", ड: "d", ढ: "d", ण: "n",
  त: "t", थ: "t", द: "d", ध: "d", न: "n",
  प: "p", फ: "f", ब: "b", भ: "b", म: "m",
  य: "y", र: "r", ल: "l", व: "v", ळ: "l",
  श: "s", ष: "s", स: "s", ह: "h",
  "ं": "n", "ँ": "n",
};

/** Devanagari written in Latin letters, near enough for its sounds. */
function latin(word: string): string {
  let out = "";
  for (const ch of word) {
    if (CONSONANTS[ch]) out += CONSONANTS[ch];
    // Any vowel or vowel sign. Which one does not matter: they are dropped.
    else if (/[ऄ-औा-ौॠॡॲ]/u.test(ch)) out += "a";
    else if (/[ऀ-ॿ]/u.test(ch)) continue;
    else out += ch;
  }
  return out;
}

/** The sounds of one word of a name. */
export function soundKey(word: string): string {
  let w = latin(word.toLowerCase()).replace(/[^a-z]/g, "");
  if (!w) return "";
  w = w
    .replace(/chh|ch/g, "C")
    .replace(/ph/g, "f")
    .replace(/sh/g, "s")
    .replace(/ck/g, "k")
    .replace(/c/g, "k")
    .replace(/C/g, "c")
    .replace(/z/g, "j")
    .replace(/w/g, "v")
    .replace(/q/g, "k")
    .replace(/x/g, "ks");
  const first = /[aeiou]/.test(w[0]!) ? "a" : w[0]!;
  // h after another letter is breath on it (bh, dh, th, kh), not a sound
  // a speech engine keeps; y between letters is a vowel in all but name.
  const rest = w.slice(1).replace(/[aeiouhy]/g, "");
  return (first + rest).replace(/(.)\1+/g, "$1");
}

const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "shri", "smt", "sri", "kumari", "master", "baby", "md", "mohd"]);

/** The words of a name that carry it, each as its sounds. */
export function soundKeys(name: string): string[] {
  return name
    .split(/[\s.,'-]+/u)
    .filter((part) => part && !TITLES.has(part.toLowerCase()))
    .map(soundKey)
    .filter((key) => key.length > 0);
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length]!;
}

function wordScore(said: string, onFile: string): number {
  if (said === onFile) return 1;
  // One sound out, in a word long enough for that to mean something.
  if (said.length >= 3 && onFile.length >= 3 && said[0] === onFile[0] && distance(said, onFile) <= 1) return 0.7;
  // The start of a longer name: "Ram" for "Ramesh".
  if (said.length >= 2 && onFile.startsWith(said)) return 0.6;
  return 0;
}

/**
 * How well a name that was said fits a name on file, 0 to 1.
 *
 * Every word that was said must be somewhere in the name on file: "Fatima
 * Syed" fits "Fatima Sayyed" and does not fit "Fatima Shaikh". A name on
 * file may have more words than were said.
 */
export function nameFit(said: string, onFile: string): number {
  const wanted = soundKeys(said);
  const have = soundKeys(onFile);
  if (wanted.length === 0 || have.length === 0) return 0;
  let total = 0;
  const used = new Set<number>();
  for (const key of wanted) {
    let best = 0;
    let at = -1;
    for (const [i, candidate] of have.entries()) {
      if (used.has(i)) continue;
      const score = wordScore(key, candidate);
      if (score > best) { best = score; at = i; }
    }
    if (best === 0) return 0;
    used.add(at);
    total += best;
  }
  return total / wanted.length;
}
