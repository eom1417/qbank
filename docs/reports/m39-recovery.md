# M39 recovery and current verification

Worktree: `/workspace/.agent-worktrees/m39`, branch `m39-detection-system`.
Runtime evidence: `/workspace/.agent-runs/m39/` (not committed).

## Interruption diagnosis

- Recovery opened `/workspace` on `main`; the pending M39 changes were in a separate
  worktree at `/tmp/m36`. They were recovered without resetting any edits.
- `/tmp` is replaceable under the container contract. The worktree was copied to
  persistent storage and repaired with `git worktree repair`. Original backup is
  `/tmp/m39-pre-recovery-backup`; it is not the active worktree.
- Previous `/tmp/int-b.txt` records 5-second test timeouts while the transcript says
  a benchmark was running simultaneously. This proves test timeouts, not a cause
  for the agent session ending. No evidence identifies the platform session cause.
- Current cgroup counters report no OOM kill. This does not establish the lifetime
  history of a previous container.
- Isolated verification with one OCR thread finished 78 import tests in 58.26 seconds,
  without timeouts: 68 passed, 10 functional failures. These need code fixes,
  not a larger test timeout.
- An additional recovery problem: this shell's HOME points to a provider-specific
  directory, so Playwright searched an empty cache. The installed browser is in
  `/root/.cache/ms-playwright`; the verification runner sets that explicit path.

## Durable execution

`scripts/run-durable-check.sh name /absolute/executable args...` starts a transient
systemd service rooted at this worktree. It sets `OMP_THREAD_LIMIT=1`, uses the
installed browser cache, and appends output under the persistent evidence folder.
All expensive checks acquire the same nonblocking lock; a competing run exits 75.
Inspect completion in its log and journal, never infer success from launch output.
Systemd services survive an agent shell ending, but not a container reboot.

## Recovered implementation fixes

- No-AI imports report `not_used`, rather than `not_ready`, and skip unavailable
  vision lessons while retaining the answer evidence combination.
- Detection doubts now survive the conversion to saved review reasons. Regression
  reproduced a valid printed answer losing its detection doubt, then passed.
- Compact table options use measured word spacing; bare table-cell labels are
  removed from option text. Both regressions were seen failing before their fix.
- Numbered explanation lists do not create extra questions. A stemless first
  option is an unplaced doubt, not an invented question.
- The existing answer-decision owner is reused to detect an explanation that
  contradicts the printed answer. Explanation prefixes are removed consistently.
- Successful checkpointed pages feed detection; failed pages are not silently
  reread as successful content.
- OCR doubts may carry source-region pixels together with numbered source lines.
  Text-only regions need no image; cache identities include rendered content.
- Explicit existing API AI modes retain their contract during migration. Default
  imports use the new detector. Removing the old modes remains unfinished.

## Checks so far

- Combined verification: 119 files, 645 tests passed in 72.70 seconds, including
  every unit/contract test and the 14 targeted import integration files.
- Later OCR repair adds three passing regressions; the final focused rerun includes
  that repair and the shared save/read progress reporter.
- Architecture, function-size/complexity and TypeScript commands passed.
- Genesis fast/full entrypoints stop at existing `ready=false`; unchanged.
- Direct format/lint initially found a recovered unformatted file and three scratch
  scripts. Formatted that file and moved scratch artifacts outside the product tree.
- Direct jscpd and dead-code commands remain failing. The three new detector/bench
  clone findings were consolidated into existing owners; other repository findings
  remain. No thresholds, suppression rules or gate configuration were changed.
- No merge, push, deployment, or deletion of the production reader was performed.

## Ownership during media stage

Coordinator owns shared contracts, orchestration, persistence and verification.
`media_parity` owns detection/link/media*.ts, read-source.ts, the new page-regions
adapter, media domain interfaces, and the media tests. No overlapping reads or edits
of those files while the agent is working. Its heavy test execution is deferred
until the single benchmark has ended.

## Final-stage additions and remaining work

- Restored rendered scan figures, ruled tables, original image resolution and
  placement certainty. Text and scanned media integration tests pass unchanged.
- Kept table data out of stems while preserving option tables as text. Existing
  explanation images retain their question, even when the next question names an image.
- One shared progress owner now records read/link/check/save success and exceptions;
  failed steps no longer stay displayed as running.
- Restored damaged-glyph OCR repair for default line reading, reusing domain/repair.
  A real cardiology comparison confirmed its missing option returned; another
  source-text fragment still differs from the ground truth.
- Split spinner styles into their component stylesheet after the file-size guard
  caught the shared stylesheet reaching 401 lines. No limits changed.
- Proven lock exclusion: qbank-m39-lock-proof exited 75 while the benchmark held
  the lock. A later checkpoint command completed successfully after release.
- Benchmark snapshot before the final media and OCR changes is in bench.log.
  It still has real-file gaps: e.g. allergy 124/159, immuno 145/205 and infect
  113/168, with several extra detections. These are not acceptance results for a
  completed replacement. Synthetic numbered-list/table-option regressions now score
  100% without their former extras.
- Old explicit read/verify modes and their readers remain. Their deletion, final
  real-file parity, 99% AI-assisted measurement and browser acceptance remain open.
- Neither platform session cancellation nor a container reboot can be prevented by
  this repository. The cause of the earlier agent-session endings is unverified.

## Parity stage (2026-11-18)

Fourteen general rules, each red then green, measured on the cached units after each step
(new path, no AI; old = develop `ef31b0a` with the same scorer):

| file | found new/old | stem new/old | options new/old | answers ok-wrong new/old |
| --- | --- | --- | --- | --- |
| allergy | 140/125 | 0.884/0.902 | 23.6%/21.6% | 48-2 / 36-0 |
| immuno | 169/145 | 0.902/0.920 | 24.3%/25.5% | 59-3 / 50-2 |
| infect | 113/109 | 0.972/0.997 | 88.5%/84.4% | 84-0 / 81-1 |
| hema | 41/41 (extra 0/1) | 1.000/1.000 | 92.7%/87.8% | 24-1 / 26-2 |
| ethics, research, cardiology, dermatology, trauma, msk | equal or better | | | |
| nephrology, neonatology, prep, gastro | equal found | 0.95-0.996 / 0.96-1.0 | equal or better | equal |

Leaks: 0 except prep 5 and nephrology 1 (old 0). Thirteen synthetic hard cases: all 100%.

Reference samples in OCR mode (`extraction-benchmark`, failing since the M39 migration):
endocrinology and cardiology now pass; nephrology misses by 2 wrong answers (0.053 vs 0.05)
and stem 0.911 vs 0.93. Two tried rules were reverted for losing more than they gained
(skipping ink on recovered options; backwards numbers). `providers` integration tests fail
identically on develop (ai-host does not start in this container).

Full suite: 1006 passed, 3 files failing (2 environmental, 1 nephrology OCR threshold).
Not yet done: nephrology OCR threshold, stem gap on allergy/immuno collage pages, deleting
the old readers, AI-assisted measurement, browser acceptance.

## Old readers removed (2026-11-18, later)

Deleted with their tests (about 2,000 lines): the M3 parser `parseQuestions`, the old key pass,
`readVirtual`, `buildQuestions`, `keysByPlace`, the old region/crop helpers and the whole-page
AI reader (`read-with-ai`, `domain/page-reading`). An import with `aiMode: 'read'` is read by
the detection with the AI on its doubts (API value kept). knip shows no new dead code.
Printed ruled tables a question reads stay text (PREP leaks 5 -> 1, stem 0.951 -> 0.962).

Open: nephrology OCR threshold (2 wrong vs 1 allowed, stem 0.911 vs 0.93); one leak each in
PREP and nephrology; AI measurement blocked: the container's ANTHROPIC_API_KEY is refused
(`invalid_key`; the run kept the rules, 0 silent); browser acceptance not run (no dev server).
