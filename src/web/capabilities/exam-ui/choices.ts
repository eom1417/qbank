import type { Choice } from '../../design-system/index.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';

interface Option {
  letter: string;
  label: string;
  text: string;
}

/** The right answers and what was chosen, once the server has revealed them. */
export interface Reveal {
  answers: readonly string[];
  chosen: readonly string[];
}

/** Right answers are marked only once they are known (UAT-041); before that, plain options. */
export function markedChoices(
  options: readonly Option[],
  reveal: Reveal | null,
  t: (key: MessageKey) => string,
): Choice[] {
  const right = new Set(reveal?.answers ?? []);
  const chosen = new Set(reveal?.chosen ?? []);
  return options.map((o) => {
    const mark: Choice['mark'] = right.has(o.letter)
      ? 'right'
      : chosen.has(o.letter)
        ? 'wrong'
        : undefined;
    return {
      value: o.letter,
      label: `${o.label} ${o.text}`,
      mark: reveal ? mark : undefined,
      markLabel: mark && t(`study.mark.${mark}`),
    };
  });
}
