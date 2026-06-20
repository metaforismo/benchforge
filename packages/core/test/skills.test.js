import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("missing YAML frontmatter");
  }
  const fields = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    fields[key.trim()] = rest.join(":").trim();
  }
  return fields;
}

test("repository skills have valid frontmatter and UI metadata", async () => {
  const skillsRoot = join(process.cwd(), "skills");
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skillDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  assert.ok(skillDirs.includes("benchforge"));
  assert.ok(skillDirs.includes("benchmark-designer"));

  for (const skillName of skillDirs) {
    const skillPath = join(skillsRoot, skillName, "SKILL.md");
    const text = await readFile(skillPath, "utf8");
    const frontmatter = parseFrontmatter(text);
    assert.equal(frontmatter.name, skillName);
    assert.ok(frontmatter.description.length >= 40);

    const openaiYaml = await readFile(join(skillsRoot, skillName, "agents", "openai.yaml"), "utf8");
    assert.match(openaiYaml, new RegExp(`\\$${skillName}\\b`));
  }
});

test("toyfail challenge skill has valid frontmatter", async () => {
  const text = await readFile(join(process.cwd(), "challenges", "toyfail", "SKILL.md"), "utf8");
  const frontmatter = parseFrontmatter(text);
  assert.equal(frontmatter.name, "toyfail");
  assert.match(frontmatter.description, /Toyfail/);
});
