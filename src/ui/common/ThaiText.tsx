import { Fragment } from 'react';

/** A Thai run, with the dots, brackets, spaces and numbers that belong to it ("ข้อ 14(1)", "ย.7"). */
const THAI_RUN = /[฀-๿]+(?:[\s.]*[฀-๿]+)*(?:\s?\d+(?:\.\d+)?(?:\(\d+\))*|\.\d+)?/g;

/** Splits text into plain and Thai parts. Pure, so it is tested without a DOM. */
export function splitThai(text: string): readonly { readonly text: string; readonly isThai: boolean }[] {
  const parts: { text: string; isThai: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(THAI_RUN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), isThai: false });
    parts.push({ text: match[0], isThai: true });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isThai: false });
  return parts;
}

export interface ThaiTextProps {
  readonly children: string;
}

/** Text from the rules data, with any Thai in it marked `lang="th"` so screen readers switch voice. */
export function ThaiText({ children }: ThaiTextProps) {
  return (
    <>
      {splitThai(children).map((part, index) => (
        <Fragment key={index}>{part.isThai ? <span lang="th">{part.text}</span> : part.text}</Fragment>
      ))}
    </>
  );
}
