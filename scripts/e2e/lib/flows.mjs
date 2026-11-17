/*
 * scripts/e2e/lib/flows.mjs — find, check and select the Maestro flows
 * (japa#361). Pure apart from reading files, so it is unit-tested
 * (scripts/e2e/__tests__/flows.test.mjs).
 *
 * A flow is one YAML file under `.maestro/flows/`. Its config section (the
 * part before the first `---` line) carries `tags:`. Every flow must have:
 *   - at least one AREA tag   (auth, self-service, flag), and
 *   - exactly one FLAG tag    (flag-on, flag-off or flag-any): the state of
 *     the self-service-only flag the flow needs. flag-on / flag-off flows set
 *     that state themselves at their start (development link from japa#375),
 *     so flows are order-independent; flag-any flows work in either state.
 * Shared steps live in `.maestro/subflows/` and runner-only flows in
 * `.maestro/support/`; neither is a suite flow.
 */
import fs from 'node:fs';
import path from 'node:path';

export const AREA_TAGS = ['auth', 'self-service', 'flag'];
export const FLAG_TAGS = ['flag-on', 'flag-off', 'flag-any'];

/** Run order of the flag groups in the summary (any, then off, then on). */
const FLAG_ORDER = { 'flag-any': 0, 'flag-off': 1, 'flag-on': 2 };

/**
 * The tags of one flow file's text. Reads only the config section (before
 * the first `---`), and accepts the two YAML list forms Maestro accepts:
 *   tags:            tags: [auth, flag-any]
 *     - auth
 *     - flag-any
 * Returns [] when there is no `tags:` key.
 */
export function parseFlowTags(text) {
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((l) => l.trim() === '---');
  const config = end === -1 ? [] : lines.slice(0, end);
  const out = [];
  for (let i = 0; i < config.length; i++) {
    const m = /^tags:\s*(.*)$/.exec(config[i]);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline.startsWith('[')) {
      // Flow-style list: tags: [a, b]
      inline
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
        .forEach((t) => out.push(t));
    } else {
      // Block list: following lines "  - tag" until the indentation ends.
      for (let j = i + 1; j < config.length; j++) {
        const item = /^\s+-\s*(.+?)\s*$/.exec(config[j]);
        if (!item) break;
        out.push(item[1].replace(/^['"]|['"]$/g, ''));
      }
    }
  }
  return out;
}

/** Problems with one flow's tags (empty array = fine). */
export function tagProblems(tags) {
  const problems = [];
  if (!tags.some((t) => AREA_TAGS.includes(t))) {
    problems.push(`needs an area tag (${AREA_TAGS.join(', ')})`);
  }
  const flags = tags.filter((t) => FLAG_TAGS.includes(t));
  if (flags.length !== 1) {
    problems.push(
      `needs exactly one flag tag (${FLAG_TAGS.join(', ')}), has ${flags.length ? flags.join(', ') : 'none'}`,
    );
  }
  return problems;
}

/** Every *.yaml / *.yml under dir, recursively, sorted. */
function yamlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...yamlFiles(p));
    else if (/\.ya?ml$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

/**
 * All suite flows under `<maestroDir>/flows`, each
 * { file, rel, name, tags, flag }. Throws one error listing every flow whose
 * tags break the rule, so a mis-tagged flow can never silently drop out of a
 * targeted run.
 */
export function discoverFlows(maestroDir) {
  const flowsDir = path.join(maestroDir, 'flows');
  const flows = yamlFiles(flowsDir).map((file) => {
    const tags = parseFlowTags(fs.readFileSync(file, 'utf8'));
    return {
      file,
      rel: path.relative(maestroDir, file),
      name: path.relative(flowsDir, file).replace(/\.ya?ml$/, ''),
      tags,
      flag: tags.find((t) => FLAG_TAGS.includes(t)),
    };
  });
  const bad = flows
    .map((f) => ({ f, problems: tagProblems(f.tags) }))
    .filter((x) => x.problems.length);
  if (bad.length) {
    throw new Error(
      'flow tags are wrong:\n' +
        bad.map((x) => `  ${x.f.rel}: ${x.problems.join('; ')}`).join('\n'),
    );
  }
  // Maestro's report names a flow by its file name, so file names must be
  // unique across folders (the summary maps report rows back by name).
  const seen = new Map();
  for (const f of flows) {
    const base = path.basename(f.file).replace(/\.ya?ml$/, '');
    if (seen.has(base)) {
      throw new Error(
        `two flows share the file name "${base}": ${seen.get(base)} and ${f.rel}`,
      );
    }
    seen.set(base, f.rel);
  }
  return flows;
}

/** Stable run order: flag-any, flag-off, flag-on; then by path. */
export function orderFlows(flows) {
  return [...flows].sort(
    (a, b) =>
      FLAG_ORDER[a.flag] - FLAG_ORDER[b.flag] || a.rel.localeCompare(b.rel),
  );
}

/**
 * The flows a run should execute.
 *   tags:  flows having ANY of these tags (Maestro's include-tags meaning)
 *   files: flows given by path (relative to cwd or absolute); each must be a
 *          suite flow under .maestro/flows
 * Both empty → every flow. Both given → the union. Throws on an unknown tag
 * or a path that is not a suite flow, and when nothing is selected.
 */
export function selectFlows(
  flows,
  { tags = [], files = [], cwd = process.cwd() } = {},
) {
  if (!tags.length && !files.length) return orderFlows(flows);
  const known = new Set(flows.flatMap((f) => f.tags));
  const unknown = tags.filter((t) => !known.has(t));
  if (unknown.length) {
    throw new Error(
      `no flow has the tag(s) ${unknown.join(', ')}; known tags: ${[...known].sort().join(', ')}`,
    );
  }
  const picked = new Set();
  for (const f of flows)
    if (f.tags.some((t) => tags.includes(t))) picked.add(f);
  for (const given of files) {
    const abs = path.resolve(cwd, given);
    const f = flows.find((x) => x.file === abs);
    if (!f) {
      throw new Error(
        `${given} is not a suite flow (expected a file under .maestro/flows/)`,
      );
    }
    picked.add(f);
  }
  return orderFlows([...picked]);
}
