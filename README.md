# cc-text

[![npm version](https://img.shields.io/npm/v/cc-text.svg)](https://www.npmjs.com/package/cc-text)
[![npm downloads](https://img.shields.io/npm/dm/cc-text.svg)](https://www.npmjs.com/package/cc-text)

How much does Claude actually say? Classifies every assistant turn by output type. 73% are completely silent.

```
npx cc-text
```

Zero dependencies. Reads `~/.claude/projects/` directly.

## Output

```
cc-text — How Much Does Claude Actually Say?
==================================================
Sessions: 2,266 | Turns: 269,656 | Silent rate: 73.4%

Assistant turn types:
  tool-only   ████████████████████  144,907   53.7%  (executes silently)
  thinking    ███████░░░░░░░░░░░░░   53,087   19.7%  (thinks silently)
  text-only   ██████████░░░░░░░░░░   71,627   26.6%  (says something)

Text length tiers (when Claude speaks):
  micro     ████████████████████   33,815   47.2%  (one-liner <50 chars)
  ack       ████████████████░░░░   27,368   38.2%  (acknowledgment 50–199)
  explain   █████░░░░░░░░░░░░░░░    8,344   11.6%  (explanation 200–999)
  essay     █░░░░░░░░░░░░░░░░░░░    2,100    2.9%  (essay 1000+)

  median 53 chars · mean 235 chars · p90 316 chars
```

## What it tells you

- **73% of turns are silent** — tool-only (54%) + thinking-only (20%). No visible text output
- **When Claude speaks, it's brief** — 47% of text turns are micro (<50 chars). Just "Done." or "Here's the result."
- **Only 3% are essays** (1000+ chars) — long explanations are rare
- **Thinking (19.7%)** — Claude reasons internally without speaking. Not visible in the chat, but counted here
- **Mean (235) >> Median (53)** — a few long explanations skew the average

## Flags

```bash
npx cc-text          # turn type distribution
npx cc-text --json   # raw JSON output
```

## Browser version

**[yurukusa.github.io/cc-text](https://yurukusa.github.io/cc-text/)** — drag and drop your projects folder.

Part of [cc-toolkit](https://yurukusa.github.io/cc-toolkit/) — tools for understanding your Claude Code sessions.

---


### Want to optimize how Claude Code uses its tools?

**[Claude Code Ops Kit](https://yurukusa.github.io/cc-ops-kit-landing/?utm_source=github&utm_medium=readme&utm_campaign=cc-text)** ($19) — 10 production hooks + 6 templates + 3 tools. Built from 160+ hours of autonomous operation.

---

*Source: [yurukusa/cc-text](https://github.com/yurukusa/cc-text)*
