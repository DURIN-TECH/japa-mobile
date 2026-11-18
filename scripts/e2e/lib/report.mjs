/*
 * scripts/e2e/lib/report.mjs — Maestro's JUnit report → the runner's
 * per-flow summary (japa#361). Pure; unit-tested.
 *
 * Maestro names each test case after the flow (its config `name:`, else the
 * file name without .yaml), so suite flows keep unique file names and no
 * `name:` (discoverFlows checks the names are unique).
 */

const unescape = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function attr(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescape(m[1]) : undefined;
}

/**
 * Test cases of a JUnit XML string:
 *   [{ name, seconds, passed, message }]
 * A case passes when it has no <failure>/<error> child (and, when Maestro
 * writes one, its status attribute is SUCCESS).
 */
export function parseJunit(xml) {
  const out = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const open = `<testcase${m[1]}>`;
    const body = m[3] ?? '';
    const fail =
      /<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>|<(failure|error)\b([^>]*)\/>/.exec(
        body,
      );
    const status = attr(open, 'status');
    const passed = !fail && (!status || status === 'SUCCESS');
    let message;
    if (fail) {
      message = unescape(
        (
          (fail[3] ?? '') ||
          attr(`<x${fail[2] ?? fail[5] ?? ''}>`, 'message') ||
          ''
        ).trim(),
      );
    }
    out.push({
      name: attr(open, 'name') ?? attr(open, 'id') ?? '?',
      seconds: Number(attr(open, 'time') ?? NaN),
      passed,
      message,
    });
  }
  return out;
}

/**
 * Joins the selected flows with the report. A selected flow missing from
 * the report (Maestro crashed before it) counts as failed.
 * → [{ flow, passed, seconds, message }]
 */
export function summarise(flows, cases) {
  return flows.map((flow) => {
    const base = flow.file
      .split('/')
      .pop()
      .replace(/\.ya?ml$/, '');
    const c = cases.find((x) => x.name === base);
    if (!c)
      return {
        flow,
        passed: false,
        seconds: NaN,
        message: 'not in the Maestro report (did not run)',
      };
    return { flow, passed: c.passed, seconds: c.seconds, message: c.message };
  });
}

/** The printed table: flow, flag state, result, duration. */
export function formatSummary(rows, totalSeconds) {
  const fmt = (s) => (Number.isFinite(s) ? `${s.toFixed(1)}s` : '-');
  const w = Math.max(4, ...rows.map((r) => r.flow.rel.length));
  const lines = [
    `${'Flow'.padEnd(w)}  ${'Flag'.padEnd(8)}  ${'Result'.padEnd(6)}  Duration`,
    `${'-'.repeat(w)}  ${'-'.repeat(8)}  ${'-'.repeat(6)}  --------`,
    ...rows.map(
      (r) =>
        `${r.flow.rel.padEnd(w)}  ${r.flow.flag.padEnd(8)}  ${(r.passed ? 'PASS' : 'FAIL').padEnd(6)}  ${fmt(r.seconds)}`,
    ),
  ];
  const passed = rows.filter((r) => r.passed).length;
  lines.push('', `${passed}/${rows.length} passed, suite ${fmt(totalSeconds)}`);
  for (const r of rows.filter((x) => !x.passed && x.message)) {
    lines.push(`  ${r.flow.rel}: ${r.message.split('\n')[0]}`);
  }
  return lines.join('\n');
}
