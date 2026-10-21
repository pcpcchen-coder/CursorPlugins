#!/usr/bin/env node
// Zero-dependency structural guard for the pcpcchen-coder/CursorPlugins fork.
// This is NOT a runtime or agent-behavior test.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = (condition, message) => {
  if (!condition) errors.push(message);
};
const at = (path) => join(root, path);
const exists = (path) => existsSync(at(path));
const json = (path) => {
  if (!exists(path)) {
    errors.push("missing JSON file: " + path);
    return {};
  }
  try {
    return JSON.parse(readFileSync(at(path), "utf8"));
  } catch (error) {
    errors.push("invalid JSON at " + path + ": " + error.message);
    return {};
  }
};

for (const path of [
  "AGENTS.md",
  "docs/fork/README.md",
  "docs/fork/PORTABILITY.md",
  "docs/fork/VALIDATION.md",
  "pstack/README.md",
  "pstack/LICENSE",
  "pstack/plugin.json",
  "pstack/.cursor-plugin/plugin.json",
  "pstack/skills/setup-pstack/SKILL.md",
  "pstack/skills/poteto-mode/SKILL.md",
  "pstack/docs/harness/claude-code.md",
  "harness/pstack/claude-code/README.md",
  "harness/pstack/claude-code/.claude-plugin/plugin.json",
  "scripts/generate-pstack-harness-trees.mjs",
  "scripts/validate-plugins.mjs",
]) {
  ok(exists(path), "missing required path: " + path);
}

const cursor = json(".cursor-plugin/marketplace.json");
const claude = json(".claude-plugin/marketplace.json");
const pstack = json("pstack/plugin.json");
const cursorPlugin = json("pstack/.cursor-plugin/plugin.json");
const generated = json("harness/pstack/claude-code/.claude-plugin/plugin.json");

const cursorSource = cursor.plugins?.find((plugin) => plugin.name === "pstack")?.source;
const claudeSource = claude.plugins?.find((plugin) => plugin.name === "pstack")?.source;
ok(cursorSource?.replace(/^\.\//, "") === "pstack", "Cursor marketplace must point to pstack");
ok(claudeSource?.replace(/^\.\//, "") === "harness/pstack/claude-code", "Claude marketplace must point to generated pstack adapter");
ok(pstack.name === "pstack", "source plugin name must be pstack");
ok(cursorPlugin.name === "pstack", "Cursor plugin name must be pstack");
ok(generated.name === "pstack", "generated Claude Code plugin name must be pstack");
if (exists("pstack/LICENSE")) {
  const license = readFileSync(at("pstack/LICENSE"), "utf8");
  ok(license.includes("MIT License"), "original pstack MIT license must be preserved");
  ok(license.includes("Lauren Tan"), "original pstack copyright must be preserved");
}

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({
    pass: errors.length === 0,
    checks: "fork structure, marketplaces, plugin names, license",
    errors
  }, null, 2) + "\n");
} else if (errors.length) {
  for (const error of errors) console.error("FAIL " + error);
  console.error("Fork guard failed: " + errors.length + " issue(s)");
} else {
  console.log("PASS fork structure, marketplaces, plugin names, license");
  console.log("NOTE runtime and generated-tree behavior require separate checks");
}
process.exitCode = errors.length ? 1 : 0;
