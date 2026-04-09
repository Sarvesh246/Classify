# Launch bug bash (student-facing)

Run after `npm run build` + `npm run test` + `npm run test:e2e` on a candidate build.

## Matrix

| Route | Desktop | Mobile WebKit | Signed out | Signed in (email) | Slow 3G (optional) |
|-------|---------|---------------|------------|---------------------|----------------------|
| `/` | | | | | |
| `/search` | | | | | |
| `/compare` | | | | | |
| `/saved` | | | | | |
| `/login` | | | | | |
| `/schools/texas-am` | | | | | |
| `/schools/texas-am/instructors` | | | | | |
| `/schools/texas-am/professors/<slug>` | | | | | |
| `/schools/texas-am/my-courses` | | | | | |
| `/methodology` | | | | | |
| `/offline` | | | | | |

## Search (must)

- [ ] No console errors on load and while typing.
- [ ] Combobox / mobile sheet opens; results appear for `Texas A&M`, `CSCE`, `Altemose`.
- [ ] First school hit uses canonical label (no alias blob).
- [ ] Nonsense query returns empty, not noise.

## Auth-sensitive (when session available)

- [ ] `/saved` lists cloud items; remove/compare actions work.
- [ ] Compare save/load (if using account).

## Performance sanity

- [ ] Search suggestions feel responsive on throttled CPU (optional).

Record build SHA, browser versions, and any issues with repro steps.
