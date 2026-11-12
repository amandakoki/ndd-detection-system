// Built-in Letter Matching levels. Used to top up the admin's learning library
// so a screening always has enough levels to be scored.

const TARGETS = ["b", "d", "p", "q", "m", "n", "u", "w", "a", "e", "s", "z"];
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

// Letters children commonly mix up
const LOOKALIKES = {
  b: ["d", "p", "q"], d: ["b", "p", "q"], p: ["q", "b", "d"], q: ["p", "d", "b"],
  m: ["n", "w"], n: ["m", "u", "h"], u: ["n", "v"], w: ["m", "v"],
  a: ["e", "o"], e: ["a", "c"], s: ["z"], z: ["s"],
};

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeLevel(target, index) {
  const looks = LOOKALIKES[target] || [];
  const others = shuffle(ALPHABET.filter((l) => l !== target && !looks.includes(l)));
  const wrong = [...looks, ...looks, ...others].slice(0, 8);
  return {
    id: `default-${index}`,
    prompt: `Tap every letter ${target}`,
    tiles: [
      ...Array(4).fill({ text: target, correct: true }),
      ...wrong.map((text) => ({ text, correct: false })),
    ],
  };
}

export function buildDefaultLevels(count) {
  const out = [];
  while (out.length < count) {
    shuffle(TARGETS).forEach((t) => out.push(t));
  }
  return out.slice(0, count).map((t, i) => makeLevel(t, i));
}

// Turn a level from the admin library (GET /api/game/levels/) into the shape the game uses.
export function normalizeLevel(apiLevel) {
  const tiles = [
    ...(apiLevel.correct_items || []).map((text) => ({ text, correct: true })),
    ...(apiLevel.other_items || []).map((text) => ({ text, correct: false })),
  ];
  return { id: `lib-${apiLevel.id}`, prompt: apiLevel.prompt, tiles };
}