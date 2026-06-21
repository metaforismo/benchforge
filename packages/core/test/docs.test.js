import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const markdownFiles = [
  "README.md",
  "docs/index.md",
  "docs/concepts.md",
  "docs/getting-started.md",
  "docs/cli-reference.md",
  "docs/challenge-author-guide.md",
  "docs/design-questionnaire.md",
  "docs/challenge-recipes.md",
  "docs/agent-guide.md",
  "docs/trust-and-anti-cheat.md",
  "docs/submission-lifecycle.md",
  "docs/update-safety.md",
  "docs/architecture.md",
  "docs/github-actions-verifier.md",
  "docs/hosted-cloudflare.md",
  "docs/ecdsafail-patterns.md"
];

function markdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith("http://") && !target.startsWith("https://"))
    .filter((target) => !target.startsWith("#"))
    .map((target) => target.split("#")[0])
    .filter(Boolean);
}

test("documentation pages have headings, ascii text, and valid relative links", async () => {
  for (const file of markdownFiles) {
    const fullPath = join(repoRoot, file);
    const markdown = await readFile(fullPath, "utf8");
    assert.match(markdown, /^# /m, `${file} should have an H1`);
    assert.doesNotMatch(markdown, /[^\x09\x0a\x0d\x20-\x7e]/, `${file} should use ASCII text`);

    for (const target of markdownLinks(markdown)) {
      const resolved = resolve(dirname(fullPath), target);
      await access(resolved);
      if (extname(resolved) === ".md") {
        const linkedMarkdown = await readFile(resolved, "utf8");
        assert.match(linkedMarkdown, /^# /m, `${target} should have an H1`);
      }
    }
  }
});
