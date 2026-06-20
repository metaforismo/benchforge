import { readFile } from "node:fs/promises";

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function requestHeaders(token = null) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    "content-type": "application/json"
  };
}

async function parseResponse(response) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `hosted API request failed with HTTP ${response.status}`);
  }
  return body;
}

export function hostedConfigFromEnv(env = process.env) {
  return {
    apiUrl: env.BENCHFORGE_API_URL ?? null,
    token: env.BENCHFORGE_API_TOKEN ?? null
  };
}

export async function publishVerifierResult(options, fetchImpl = globalThis.fetch) {
  const apiUrl = trimSlash(requireString(options.apiUrl, "apiUrl"));
  const token = requireString(options.token, "token");
  const result = options.result ?? JSON.parse(await readFile(options.file, "utf8"));
  const challengeId = requireString(options.challengeId ?? result.challenge?.id, "challengeId");
  const response = await fetchImpl(`${apiUrl}/api/challenges/${encodeURIComponent(challengeId)}/verifier-results`, {
    method: "POST",
    headers: requestHeaders(token),
    body: JSON.stringify(result)
  });
  return parseResponse(response);
}

export async function fetchHostedLeaderboard(options, fetchImpl = globalThis.fetch) {
  const apiUrl = trimSlash(requireString(options.apiUrl, "apiUrl"));
  const challengeId = requireString(options.challengeId, "challengeId");
  const response = await fetchImpl(`${apiUrl}/api/challenges/${encodeURIComponent(challengeId)}/leaderboard`);
  return parseResponse(response);
}

export async function addHostedNote(options, fetchImpl = globalThis.fetch) {
  const apiUrl = trimSlash(requireString(options.apiUrl, "apiUrl"));
  const token = requireString(options.token, "token");
  const challengeId = requireString(options.challengeId, "challengeId");
  const body = {
    title: options.title ?? "Agent note",
    body: requireString(options.body, "body"),
    author: options.author ?? "anonymous"
  };
  const response = await fetchImpl(`${apiUrl}/api/challenges/${encodeURIComponent(challengeId)}/notes`, {
    method: "POST",
    headers: requestHeaders(token),
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

export async function searchHostedNotes(options, fetchImpl = globalThis.fetch) {
  const apiUrl = trimSlash(requireString(options.apiUrl, "apiUrl"));
  const challengeId = requireString(options.challengeId, "challengeId");
  const params = new URLSearchParams();
  if (options.query) params.set("q", options.query);
  if (options.limit) params.set("limit", String(options.limit));
  const suffix = params.size > 0 ? `?${params}` : "";
  const response = await fetchImpl(`${apiUrl}/api/challenges/${encodeURIComponent(challengeId)}/notes${suffix}`);
  return parseResponse(response);
}
