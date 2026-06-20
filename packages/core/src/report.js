import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { rankRuns } from "./leaderboard.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function exportReport(spec, runs) {
  const ranked = rankRuns(spec, runs);
  const outputDir = join(spec.root, ".benchforge", "site");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, "index.html");

  const rows = ranked.map((run, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(run.score)}</td>
      <td>${escapeHtml(run.status)}</td>
      <td>${escapeHtml(run.id)}</td>
      <td>${escapeHtml(run.createdAt)}</td>
    </tr>
  `).join("");

  await writeFile(outputPath, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(spec.name)} Leaderboard</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 40px; color: #1f2923; background: #f7f7f1; }
    h1 { font-size: 40px; margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th, td { border-bottom: 1px solid #d9d9ce; padding: 12px; text-align: left; }
    th { color: #65736b; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>${escapeHtml(spec.name)}</h1>
  <p>Local leaderboard. Public leaderboards should use verified or promoted runs.</p>
  <table>
    <thead><tr><th>#</th><th>Score</th><th>Status</th><th>Run</th><th>Created</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`, "utf8");

  return outputPath;
}
