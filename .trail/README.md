# .trail

What coding sessions on this repo worked out, kept next to the code so the
next session, yours or a teammate's, starts from it instead of digging again.

- learnings/   one file per session that took real digging: what was decided,
               what was tried and ruled out, and what to watch out for, plus
               what it took to work out
- hook.cjs     what Claude Code runs at session start (`.claude/settings.json`).
               With trail installed it hands over to trail. Without it, it
               shows Claude these learnings and offers to set trail up.

Commit this folder and `.claude/settings.json` once. After that, commit new
learnings with the change they came from. Learnings are short summaries, never
transcripts, and plain markdown without trail installed. What
`.trail/.gitignore` lists stays on each machine.

## Shared code-map wiring

`cache` is a symlink to `../graft`: this preserves the existing code-map path
while supporting Trail’s cache lookup. `graft/.gitkeep` keeps its target present
on a fresh clone; generated graph contents remain ignored. Run `trail build`,
then `trail build --check`. `trail check` checks learnings, not graph freshness.

Both `.trail/hook.cjs` and `.trail/statusline.cjs` are shared. All lifecycle hooks,
statuslines, and Trail permissions live in `.claude/settings.json`; no local
settings file is needed. Install/provide `@trailhq/trail-code` on PATH to enable
the hooks. The upstream shims retain old-package fallbacks for compatibility.

`graft/.cache/wiring-stamp.json` is intentionally shared init intent, not graph
data: Trail 0.23.0 otherwise re-initializes an unstamped fresh clone, moves shared
hooks into local settings, drops MCP registration, and defaults to global writes.
The stamp records the tested CLI version and `global: false`; after a Trail
upgrade, reconcile shared wiring and this version together. Other cache contents
remain ignored.
