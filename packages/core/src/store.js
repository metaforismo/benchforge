import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

export function getStoreDir(root) {
  return join(root, ".benchforge");
}

async function ensureStore(root) {
  await mkdir(getStoreDir(root), { recursive: true });
}

async function appendJsonLine(path, value) {
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

async function readJsonLines(path) {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function appendRun(root, run) {
  await ensureStore(root);
  const record = {
    id: `run_${randomUUID()}`,
    createdAt: nowIso(),
    ...run
  };
  await appendJsonLine(join(getStoreDir(root), "runs.jsonl"), record);
  return record;
}

export async function listRuns(root) {
  return readJsonLines(join(getStoreDir(root), "runs.jsonl"));
}

export async function appendNote(root, note) {
  await ensureStore(root);
  const record = {
    id: `note_${randomUUID()}`,
    createdAt: nowIso(),
    tags: [],
    ...note
  };
  await appendJsonLine(join(getStoreDir(root), "notes.jsonl"), record);
  return record;
}

export async function listNotes(root, query = "") {
  const notes = await readJsonLines(join(getStoreDir(root), "notes.jsonl"));
  const needle = query.toLowerCase();
  if (!needle) return notes;
  return notes.filter((note) => {
    const text = `${note.text ?? ""} ${(note.tags ?? []).join(" ")}`.toLowerCase();
    return text.includes(needle);
  });
}
