#!/usr/bin/env node
// cc-text — How much does Claude actually say?
// Classifies every assistant turn by output type:
// tool-only (silent), text-only, thinking-only, and text length tiers.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { cpus } from 'os';

const CONCURRENCY = Math.min(cpus().length, 8);
const MIN_TURNS = 3;

const TEXT_TIERS = [
  { key: 'micro',   label: 'micro   ', max: 49,   desc: 'one-liner (<50 chars)' },
  { key: 'ack',     label: 'ack     ', max: 199,  desc: 'acknowledgment (50–199)' },
  { key: 'explain', label: 'explain ', max: 999,  desc: 'explanation (200–999)' },
  { key: 'essay',   label: 'essay   ', max: Infinity, desc: 'essay (1000+)' },
];

function analyzeFile(text) {
  let toolOnly = 0, textOnly = 0, thinkingOnly = 0, thinkingTool = 0, totalTurns = 0;
  const textLengths = [];
  const tierCounts = Object.fromEntries(TEXT_TIERS.map(t => [t.key, 0]));
  let totalTextChars = 0;

  for (const line of text.split('\n')) {
    if (!line.includes('"assistant"')) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const msg = obj.message || obj;
    if (msg.role !== 'assistant') continue;
    const content = msg.content;
    if (!Array.isArray(content)) continue;

    totalTurns++;
    const types = new Set(content.map(b => b.type));
    const hasTool = types.has('tool_use');
    const hasText = types.has('text');
    const hasThink = types.has('thinking');

    if (hasTool && !hasText) {
      toolOnly++;
    } else if (hasText && !hasTool) {
      textOnly++;
      const chars = content.filter(b => b.type === 'text').reduce((s, b) => s + (b.text || '').length, 0);
      textLengths.push(chars);
      totalTextChars += chars;
      for (const tier of TEXT_TIERS) {
        if (chars <= tier.max) { tierCounts[tier.key]++; break; }
      }
    } else if (hasThink && !hasTool && !hasText) {
      thinkingOnly++;
    } else if (hasThink && hasTool) {
      thinkingTool++;
    }
  }

  return { toolOnly, textOnly, thinkingOnly, thinkingTool, totalTurns, textLengths, tierCounts, totalTextChars };
}

function mergeResults(results) {
  const merged = {
    sessions: 0,
    toolOnly: 0, textOnly: 0, thinkingOnly: 0, thinkingTool: 0, totalTurns: 0,
    tierCounts: Object.fromEntries(TEXT_TIERS.map(t => [t.key, 0])),
    allTextLengths: [],
    totalTextChars: 0,
  };

  for (const r of results) {
    if (r.totalTurns < MIN_TURNS) continue;
    merged.sessions++;
    merged.toolOnly += r.toolOnly;
    merged.textOnly += r.textOnly;
    merged.thinkingOnly += r.thinkingOnly;
    merged.thinkingTool += r.thinkingTool;
    merged.totalTurns += r.totalTurns;
    merged.totalTextChars += r.totalTextChars;
    for (const k of Object.keys(merged.tierCounts)) merged.tierCounts[k] += r.tierCounts[k];
    merged.allTextLengths.push(...r.textLengths);
  }

  merged.allTextLengths.sort((a, b) => a - b);
  const n = merged.allTextLengths.length;
  merged.median = n > 0 ? merged.allTextLengths[Math.floor(n / 2)] : 0;
  merged.mean = n > 0 ? Math.round(merged.totalTextChars / n) : 0;
  merged.p90 = n > 0 ? merged.allTextLengths[Math.floor(n * 0.9)] : 0;
  merged.silentRate = merged.totalTurns > 0
    ? ((merged.toolOnly + merged.thinkingOnly) / merged.totalTurns * 100).toFixed(1)
    : '0.0';
  return merged;
}

function findJsonlFiles(dir) {
  const files = [];
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      try {
        const st = statSync(p);
        if (st.isDirectory()) files.push(...findJsonlFiles(p));
        else if (name.endsWith('.jsonl')) files.push(p);
      } catch {}
    }
  } catch {}
  return files;
}

async function processFiles(files) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const f = files[idx++];
      try { results.push(analyzeFile(readFileSync(f, 'utf8'))); } catch {}
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function bar(n, max, width = 20) {
  const f = max > 0 ? Math.round((n / max) * width) : 0;
  return '█'.repeat(f) + '░'.repeat(width - f);
}

function pct(n, total) {
  return total > 0 ? (n / total * 100).toFixed(1) : '0.0';
}

function renderOutput(m, isJson) {
  if (isJson) {
    console.log(JSON.stringify({
      sessions: m.sessions,
      totalTurns: m.totalTurns,
      silentRate: +m.silentRate,
      turnTypes: {
        toolOnly:    { count: m.toolOnly,    pct: +(pct(m.toolOnly, m.totalTurns)) },
        textOnly:    { count: m.textOnly,    pct: +(pct(m.textOnly, m.totalTurns)) },
        thinkingOnly:{ count: m.thinkingOnly,pct: +(pct(m.thinkingOnly, m.totalTurns)) },
      },
      textLengths: {
        median: m.median, mean: m.mean, p90: m.p90,
        tiers: Object.fromEntries(TEXT_TIERS.map(t => [t.key, {
          count: m.tierCounts[t.key],
          pct: +(pct(m.tierCounts[t.key], m.textOnly)),
        }])),
      },
    }, null, 2));
    return;
  }

  const maxN = Math.max(m.toolOnly, m.textOnly, m.thinkingOnly);
  console.log('\ncc-text — How Much Does Claude Actually Say?');
  console.log('='.repeat(50));
  console.log(`Sessions: ${m.sessions.toLocaleString()} | Turns: ${m.totalTurns.toLocaleString()} | Silent rate: ${m.silentRate}%`);
  console.log('\nAssistant turn types:');
  console.log(`  tool-only   ${bar(m.toolOnly, maxN)}  ${m.toolOnly.toLocaleString().padStart(7)}  ${pct(m.toolOnly, m.totalTurns).padStart(5)}%  (executes silently)`);
  console.log(`  thinking    ${bar(m.thinkingOnly, maxN)}  ${m.thinkingOnly.toLocaleString().padStart(7)}  ${pct(m.thinkingOnly, m.totalTurns).padStart(5)}%  (thinks silently)`);
  console.log(`  text-only   ${bar(m.textOnly, maxN)}  ${m.textOnly.toLocaleString().padStart(7)}  ${pct(m.textOnly, m.totalTurns).padStart(5)}%  (says something)`);

  const maxTier = Math.max(...TEXT_TIERS.map(t => m.tierCounts[t.key]));
  console.log('\nText length tiers (when Claude speaks):');
  for (const tier of TEXT_TIERS) {
    const n = m.tierCounts[tier.key];
    const p = pct(n, m.textOnly);
    console.log(`  ${tier.label}  ${bar(n, maxTier)}  ${n.toLocaleString().padStart(7)}  ${p.padStart(5)}%  (${tier.desc})`);
  }
  console.log(`\n  median ${m.median} chars · mean ${m.mean} chars · p90 ${m.p90} chars\n`);
}

// ── CLI entry ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isJson = args.includes('--json');

const dataDir = resolve(process.env.HOME || '~', '.claude', 'projects');
const files = findJsonlFiles(dataDir);

if (files.length === 0) {
  console.error('No .jsonl files found in ~/.claude/projects/');
  process.exit(1);
}

const rawResults = await processFiles(files);
const merged = mergeResults(rawResults);
renderOutput(merged, isJson);
