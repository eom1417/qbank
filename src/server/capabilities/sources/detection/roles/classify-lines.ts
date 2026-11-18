import type { FileLines, LineRole } from '../contract.js';
import { markCases } from './cases.js';
import { pageRole, keyRole } from './fixed-roles.js';
import { measureOf } from './geometry.js';
import { questionRole } from './question-roles.js';
import { promptRole } from './prompts.js';
import { signalsOf } from './signals.js';
import { textRole } from './text-roles.js';
import { followText, startWalk } from './walk.js';

// M39 step 3 (plan §3): one role for every line, by one generic set of rules. No rule knows the
// file's kind, name or font; every distance is the file's own (its layout). Below 0.5 the rule
// is unsure and the line is a doubt for the checks.

export function classifyLines(file: FileLines): LineRole[] {
  const measure = measureOf(file);
  const walk = startWalk(file, measure, signalsOf(file, measure));
  file.lines.forEach((line, index) => {
    const signals = walk.signals[index];
    if (!signals) return;
    const role =
      pageRole(walk, line, signals) ??
      keyRole(walk, line, signals) ??
      questionRole(walk, line, signals) ??
      promptRole(walk, line, signals) ??
      textRole(walk, line, signals);
    walk.roles.push(role);
    followText(walk, line, role);
    if (role.role !== 'filler' && role.role !== 'note') walk.above = line;
  });
  markCases(file, walk.roles, measure);
  return walk.roles;
}
