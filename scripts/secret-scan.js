#!/usr/bin/env node

/**
 * secret-scan.js — SIFT Project Secret Scanner
 * Governed by AGENTS.md Standing Contract, DEC-007, REQ-013, and IC-011.
 *
 * Rules:
 * 1. Reads values from .env without printing or leaking them.
 * 2. Searches working tree, git history, and build outputs for:
 *    a) Values defined in .env (if .env exists).
 *    b) Common high-entropy key / secret patterns (e.g., Google AI Studio keys, private keys).
 * 3. Prints ONLY MATCH / NO MATCH and file paths (never secret values).
 * 4. Exits with 0 if NO MATCH, 1 if MATCH.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');


// Common credential patterns to detect
const COMMON_PATTERNS = [
  { name: 'Google/Gemini API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'Generic Secret Assignment', regex: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g }
];

// Directories and files to exclude from scanning
const IGNORED_PATHS = [
  '.git',
  'node_modules',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.example',
  'scratch'
];

function readEnvValues() {
  const envValues = [];
  if (!fs.existsSync(ENV_FILE)) {
    return envValues;
  }

  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    if (val.length >= 6 && !val.startsWith('placeholder') && !val.startsWith('your_') && !val.startsWith('<')) {
      envValues.push(val);
    }
  }

  return envValues;
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

    if (IGNORED_PATHS.some(ignored => relPath === ignored || relPath.startsWith(ignored + '/'))) {
      continue;
    }

    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function scanWorkingTree(envValues) {
  const matches = [];
  const files = getAllFiles(ROOT_DIR);

  for (const filePath of files) {
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    for (const secretVal of envValues) {
      if (content.includes(secretVal)) {
        matches.push({ type: 'ENV_SECRET_VALUE', file: relPath });
      }
    }

    for (const pat of COMMON_PATTERNS) {
      pat.regex.lastIndex = 0;
      if (pat.regex.test(content)) {
        matches.push({ type: pat.name, file: relPath });
      }
    }
  }

  return matches;
}

function scanGitHistory(envValues) {
  const matches = [];
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: ROOT_DIR, stdio: 'ignore' });
  } catch {
    return matches;
  }

  let gitLog;
  try {
    gitLog = execSync('git log -p -n 50', { cwd: ROOT_DIR, encoding: 'utf8' });
  } catch {
    return matches;
  }

  for (const secretVal of envValues) {
    if (gitLog.includes(secretVal)) {
      matches.push({ type: 'ENV_SECRET_VALUE', file: 'git-history' });
    }
  }

  for (const pat of COMMON_PATTERNS) {
    pat.regex.lastIndex = 0;
    if (pat.regex.test(gitLog)) {
      matches.push({ type: pat.name, file: 'git-history' });
    }
  }

  return matches;
}

function main() {
  const envValues = readEnvValues();
  const workingMatches = scanWorkingTree(envValues);
  const gitMatches = scanGitHistory(envValues);

  const allMatches = [...workingMatches, ...gitMatches];

  if (allMatches.length > 0) {
    console.error('MATCH: Secrets or high-entropy credentials detected!');
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    for (const f of uniqueFiles) {
      console.error(`  MATCH: ${f}`);
    }
    process.exit(1);
  } else {
    console.log('NO MATCH: No secrets detected in working tree or git history.');
    process.exit(0);
  }
}

main();
