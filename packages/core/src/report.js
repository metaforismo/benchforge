import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLeaderboardData } from "./leaderboard-data.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatScore(value) {
  if (typeof value !== "number") return "n/a";
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function formatDiff(diff) {
  if (!diff) return "n/a";
  const value = formatScore(diff.value);
  const percent = typeof diff.percent === "number" ? `${diff.percent.toFixed(2)}%` : "n/a";
  return `${value} (${percent})`;
}

function metricSummary(metrics) {
  return Object.entries(metrics ?? {})
    .map(([key, value]) => `${key}: ${formatScore(value)}`)
    .join(" | ");
}

export async function exportReport(spec, runs, submissions = []) {
  const data = buildLeaderboardData(spec, runs, submissions);
  const outputDir = join(spec.root, ".benchforge", "site");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, "index.html");
  const jsonPath = join(outputDir, "leaderboard.json");

  const rows = data.entries.map((entry) => `
    <tr>
      <td>${entry.rank}</td>
      <td>${escapeHtml(formatScore(entry.score))}</td>
      <td class="${entry.diff?.improved ? "improved" : ""}">${escapeHtml(formatDiff(entry.diff))}</td>
      <td><span class="status status-${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${escapeHtml(entry.metadata.solver ?? "")}</td>
      <td>${escapeHtml(entry.metadata.model ?? "")}</td>
      <td>${escapeHtml(entry.runId)}</td>
      <td>${escapeHtml(entry.submissionId ?? "")}</td>
      <td>${escapeHtml(entry.createdAt)}</td>
      <td>
        <details>
          <summary>Details</summary>
          <div class="detail">
            <p><strong>Score</strong><br>${escapeHtml(formatScore(entry.score))}</p>
            <p><strong>Metrics</strong><br>${escapeHtml(metricSummary(entry.metrics))}</p>
            <p><strong>Diff</strong><br>${escapeHtml(formatDiff(entry.diff))}</p>
            <p><strong>Note</strong><br>${escapeHtml(entry.metadata.note ?? "")}</p>
            ${entry.metadata.commitUrl ? `<p><a href="${escapeHtml(entry.metadata.commitUrl)}">View commit</a></p>` : ""}
          </div>
        </details>
      </td>
    </tr>
  `).join("");

  const historyRows = data.history.slice(-12).map((point) => `
    <li>
      <span>${escapeHtml(formatScore(point.bestScore))}</span>
      <small>${escapeHtml(point.status)} - ${escapeHtml(point.createdAt)}</small>
    </li>
  `).join("");

  const publicBest = data.best.public;
  const anyBest = data.best.any;

  await writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  await writeFile(outputPath, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(spec.name)} Leaderboard</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; color: #1f2923; background: #f7f7f1; }
    header { background: #1f7449; color: #fffdf6; padding: 56px max(24px, 7vw); }
    main { padding: 32px max(24px, 7vw) 64px; }
    h1 { font-size: 72px; line-height: 1; margin: 0 0 18px; letter-spacing: 0; max-width: 980px; }
    h2 { font-size: 18px; margin: 0 0 16px; }
    p { max-width: 760px; line-height: 1.5; }
    .metrics { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 32px; }
    .metric { border-top: 1px solid rgba(255,255,255,.35); padding-top: 16px; }
    .metric strong { display: block; font-size: 30px; line-height: 1.1; }
    .metric span { color: rgba(255,255,255,.76); }
    section { margin-top: 34px; }
    table { border-collapse: collapse; width: 100%; background: #fffdf6; box-shadow: 0 0 0 1px #deded2; }
    th, td { border-bottom: 1px solid #deded2; padding: 13px 12px; text-align: left; vertical-align: top; }
    th { color: #65736b; font-size: 12px; text-transform: uppercase; }
    td { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
    .status { border-radius: 999px; padding: 4px 9px; color: #fff; background: #637064; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; }
    .status-local { background: #6f7770; }
    .status-accepted { background: #2d7f95; }
    .status-verified { background: #226fb3; }
    .status-promoted, .status-replicated { background: #1f7449; }
    .improved { color: #1f7449; font-weight: 700; }
    details summary { cursor: pointer; font-family: ui-sans-serif, system-ui, sans-serif; color: #1f7449; }
    .detail { min-width: 280px; max-width: 520px; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.45; }
    .detail p { margin: 12px 0; }
    .detail a { color: #1f7449; font-weight: 700; }
    .history { display: grid; gap: 10px; list-style: none; padding: 0; margin: 0; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
    .history li { background: #fffdf6; border: 1px solid #deded2; padding: 14px; }
    .history span { display: block; font-weight: 700; }
    .history small { color: #65736b; }
    @media (max-width: 720px) { table { display: block; overflow-x: auto; } h1 { font-size: 42px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(spec.name)}</h1>
    <p>Benchmark arena leaderboard. Public trust starts at verified/promoted results; local and accepted runs are useful for iteration.</p>
    <div class="metrics">
      <div class="metric"><strong>${escapeHtml(formatScore(publicBest?.score))}</strong><span>Best public score</span></div>
      <div class="metric"><strong>${escapeHtml(formatScore(anyBest?.score))}</strong><span>Best local/any score</span></div>
      <div class="metric"><strong>${data.counts.promoted}</strong><span>Promoted runs</span></div>
      <div class="metric"><strong>${data.counts.submissions}</strong><span>Submissions</span></div>
    </div>
  </header>
  <main>
    <section>
      <h2>Score History</h2>
      <ul class="history">${historyRows}</ul>
    </section>
    <section>
      <h2>Leaderboard</h2>
      <table>
        <thead><tr><th>#</th><th>Score</th><th>Diff</th><th>Status</th><th>Solver</th><th>Model</th><th>Run</th><th>Submission</th><th>Created</th><th>Details</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`, "utf8");

  return outputPath;
}
