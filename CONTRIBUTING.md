# Contributing

Thanks for your interest. This is a small plugin shipping skills for the [MapX SDK](https://github.com/unep-grid/mapx) — there is no build step, no runtime code, just Markdown knowledge files consumed by Claude Code / GitHub Copilot CLI at prompt time.

Corrections and additions from people who know MapX better than I do are explicitly welcome — see the "note on accuracy" in the README.

## Filing issues

Open an issue at https://github.com/khawkins98/mapx-llm-skills/issues. Most useful issue types:

- **Wrong information in a skill** — link the file and line, paste the wrong claim, and the correction.
- **Missing pattern** — what you tried to do, what wasn't documented, what the actual answer turned out to be.
- **Outdated SDK behaviour** — MapX SDK version (current target as of writing: 1.13.19), the resolver name affected, observed vs documented behaviour.

## Proposing changes

1. Fork the repo and branch off `main`.
2. Edit the relevant `SKILL.md` or supporting `.md` file under `skills/<skill-name>/`. Keep examples compact and copy-pasteable.
3. If you change facts that are also mirrored in `README.md`, update both.
4. Open a draft PR while you iterate.

## What to watch when editing skills

- The YAML frontmatter `description` in `SKILL.md` controls auto-detection — don't break it lightly.
- Don't add a `skills` field to `.claude-plugin/plugin.json`. Claude Code rejects it with a validation error.
- Verify code examples against known SDK quirks (silent-failure resolvers, removed methods like `toggle_draw_mode`). The CLAUDE.md file lists the major ones.

## Branch and commit style

- Branches: descriptive, e.g. `docs/limitations-merge`, `feat/api-search-skill`.
- Commits: Conventional Commits (`docs:`, `feat:`, `fix:`, `chore:`) — match recent history.

## Review

Best-effort. If you've spotted something MapX-related that's clearly wrong, expect a fast merge.

## License

MIT. See [LICENSE](LICENSE).
