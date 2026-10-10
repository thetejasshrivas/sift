#!/usr/bin/env node

/**
 * benchmark-scoring.js — Runner for SIFT Scoring Engine Benchmark
 * Governed by PRD REQ-009, §6.2, §8.3, TS-006.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

try {
  execSync('npx vite-node scripts/benchmark-scoring.ts', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
} catch (err) {
  process.exit(1);
}
