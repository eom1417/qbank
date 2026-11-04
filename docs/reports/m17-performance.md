# M17.5 Performance at real sizes

Run: `npm run bench:perf` (Postgres test database; `PERF_PAGES=<n>` shortens the book).
Measured 2026-11-04 on the development container. Times are medians of 5 runs.

## A bank of 10,000 questions with history (`tests/perf/library-scale.perf.ts`)

The bank has 2,000 questions waiting for review and 10 answered Tutor sessions of 100.

| Screen                         | Median | Budget |
| ------------------------------ | ------ | ------ |
| Library                        | 1 ms   | 300 ms |
| Search in stems and options    | 35 ms  | 300 ms |
| Review queue                   | 21 ms  | 500 ms |
| Start a random session (40)    | 89 ms  | 500 ms |
| Start a Smart Mix session (40) | 92 ms  | 500 ms |
| Due reviews                    | 76 ms  | 500 ms |
| Analytics summary              | 96 ms  | 500 ms |
| Session history                | 2 ms   | 500 ms |

## A 1500-page book (`tests/perf/import-scale.perf.ts`)

The book has 5 different questions per page and a figure every 5th page. It is printed by the test browser.

| Measure         | Result                  | Budget          |
| --------------- | ----------------------- | --------------- |
| Time            | 154 s (103 ms per page) | 400 ms per page |
| Questions found | 7,500 of 7,500          | all             |
| Memory growth   | +412 MB                 | 600 MB          |

## Found and fixed

1. **Every page render was kept until the end of an import.** That is about 1 MB per page, or 1.4 GB for the book. Now only the 4 most recent are kept (`rasterCache`).
2. **All duplicate pairs were saved in one statement.** Past Postgres' 65,535 parameters, the whole import failed as `internal`; this happened at 150 pages of similar questions. Pairs are now saved 1,000 per statement.
3. **Templated questions produced unbounded duplicate pairs** (memory, then a crash at 1,500 pages). Each new question now keeps at most its 5 strongest pairs, exact copies first. The `duplicate` reason needs only one exact pair.
