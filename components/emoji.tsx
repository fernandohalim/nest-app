import { JSX } from "react";

const toCodepoint = (char: string): string => {
  const codepoints: string[] = [];
  // Array.from correctly splits surrogate pairs into proper code points
  for (const ch of Array.from(char)) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // skip the variation selector — twemoji omits it from filenames
    if (cp === 0xfe0f) continue;
    codepoints.push(cp.toString(16));
  }
  return codepoints.join("-");
};

interface EmojiProps {
  /** single emoji character, e.g. "🐣" */
  char: string;
  /** optional accessible label; defaults to the emoji char itself */
  ariaLabel?: string;
  /** appended to the default `.twemoji` class for size/spacing overrides */
  className?: string;
}

export default function Emoji({
  char,
  ariaLabel,
  className = "",
}: EmojiProps): JSX.Element {
  const codepoint = toCodepoint(char);
  const src = `/emoji/${codepoint}.svg`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={ariaLabel ?? char}
      draggable={false}
      className={`emoji ${className}`.trim()}
    />
  );
}
