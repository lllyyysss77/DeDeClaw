#!/usr/bin/env node

/**
 * 打包前预处理脚本：使用 pnpm deploy 将 api-server 及其所有依赖（含间接依赖）
 * 展平到 apps/desktop/.api-server-bundle 目录，供 electron-builder extraResources 使用。
 *
 * pnpm 使用符号链接管理 node_modules，electron-builder 的 extraResources
 * 无法正确解析这些符号链接。pnpm deploy 是官方推荐的打包部署方案，
 * 它会将所有 production 依赖展平为真实文件，生成一个自包含的目录。
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '../..');
const API_SERVER_ROOT = path.resolve(DESKTOP_ROOT, '../api-server');
const BUNDLE_DIR = path.resolve(DESKTOP_ROOT, '.api-server-bundle');

const log = (msg) => console.log(`[bundle-api] ${msg}`);
const fatal = (msg) => { console.error(`[bundle-api] ❌ ${msg}`); process.exit(1); };

// ── 1. 编译 api-server ──────────────────────────────────────────────
log('编译 api-server ...');
try {
  execSync('pnpm --filter api-server build', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
} catch {
  fatal('api-server 编译失败');
}

const apiDistDir = path.join(API_SERVER_ROOT, 'dist');
if (!fs.existsSync(path.join(apiDistDir, 'index.js'))) {
  fatal('api-server/dist/index.js 不存在，编译可能失败');
}

// ── 2. 生成 prisma client ───────────────────────────────────────────
log('生成 prisma client ...');
try {
  execSync('pnpm --filter api-server run db:generate', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
} catch {
  fatal('prisma generate 失败，请检查 prisma/schema.prisma');
}

// ── 3. 清理旧 bundle ────────────────────────────────────────────────
if (fs.existsSync(BUNDLE_DIR)) {
  log('清理旧 bundle ...');
  fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
}

// ── 4. 使用 pnpm deploy 生成自包含目录 ──────────────────────────────
log('执行 pnpm deploy（展平所有依赖）...');
try {
  execSync(`pnpm --filter api-server deploy "${BUNDLE_DIR}" --prod --legacy`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
} catch {
  fatal('pnpm deploy 失败');
}

// ── 5. 将编译后的 dist 复制到 bundle ────────────────────────────────
// pnpm deploy 复制的是 src 目录，我们需要 dist 目录
log('复制编译产物 dist/ ...');
const bundleDistDir = path.join(BUNDLE_DIR, 'dist');
if (fs.existsSync(bundleDistDir)) {
  fs.rmSync(bundleDistDir, { recursive: true, force: true });
}
fs.cpSync(apiDistDir, bundleDistDir, { recursive: true });

// ── 6. 确保 .prisma/client (generated) 存在 ────────────────────────
log('检查 prisma generated client ...');
const generatedClientDir = path.join(BUNDLE_DIR, 'node_modules', '.prisma', 'client');

if (!fs.existsSync(path.join(generatedClientDir, 'index.js'))) {
  log('.prisma/client 不在 bundle 中，从 pnpm store 查找并复制 ...');

  const pnpmStoreBase = path.join(REPO_ROOT, 'node_modules', '.pnpm');
  let found = false;

  if (fs.existsSync(pnpmStoreBase)) {
    for (const entry of fs.readdirSync(pnpmStoreBase)) {
      if (!entry.startsWith('@prisma+client@')) continue;
      const candidatePath = path.join(pnpmStoreBase, entry, 'node_modules', '.prisma', 'client');
      if (fs.existsSync(path.join(candidatePath, 'index.js'))) {
        log(`找到 prisma generated client: ${candidatePath}`);
        fs.mkdirSync(path.dirname(generatedClientDir), { recursive: true });
        fs.cpSync(candidatePath, generatedClientDir, { recursive: true, dereference: true });
        found = true;
        break;
      }
    }
  }

  if (!found) {
    fatal('未找到 .prisma/client generated 文件，请先运行: pnpm --filter api-server run db:generate');
  }
}

// ── 7. 提升 .pnpm 中未被提升的 optional native 依赖 ────────────────
log('提升 native optional dependencies ...');

/**
 * pnpm deploy --legacy 有时不会将 optionalDependencies（如 sharp 的平台特定包）
 * 提升到顶层 node_modules，导致运行时 require 找不到。
 * 从 .pnpm/<pkg>/node_modules/ 中查找并复制到顶层。
 */
const hoistFromPnpm = (pkgName, pnpmParentPattern) => {
  const topLevelDest = path.join(BUNDLE_DIR, 'node_modules', pkgName);
  if (fs.existsSync(topLevelDest)) return; // 已存在则跳过

  const pnpmBase = path.join(BUNDLE_DIR, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmBase)) return;

  for (const entry of fs.readdirSync(pnpmBase)) {
    if (!entry.startsWith(pnpmParentPattern)) continue;
    const candidate = path.join(pnpmBase, entry, 'node_modules', pkgName);
    if (fs.existsSync(candidate)) {
      log(`  提升 ${pkgName} -> node_modules/${pkgName}`);
      fs.mkdirSync(path.dirname(topLevelDest), { recursive: true });
      fs.cpSync(candidate, topLevelDest, { recursive: true, dereference: true });
      return;
    }
  }
};

// sharp 的平台 native 包
hoistFromPnpm('@img/sharp-darwin-arm64', 'sharp@');
hoistFromPnpm('@img/sharp-libvips-darwin-arm64', 'sharp@');
hoistFromPnpm('@img/colour', 'sharp@');

// bcrypt 的 native 依赖（如果需要）
hoistFromPnpm('@mapbox/node-pre-gyp', 'bcrypt@');

// ── 8. 验证 bundle 完整性 ───────────────────────────────────────────
log('验证 bundle 完整性 ...');

const requiredFiles = [
  'dist/index.js',
  'package.json',
  'node_modules/.prisma/client/index.js',
];

let allGood = true;
for (const relPath of requiredFiles) {
  const fullPath = path.join(BUNDLE_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ 缺少: ${relPath}`);
    allGood = false;
  } else {
    log(`  ✓ ${relPath}`);
  }
}

// 检查原生 prisma engine
const hasNativeEngine = fs.readdirSync(generatedClientDir)
  .some((f) => f.startsWith('libquery_engine') && f.endsWith('.node'));

if (!hasNativeEngine) {
  console.error('  ❌ 缺少 prisma native query engine (.node 文件)');
  allGood = false;
} else {
  log('  ✓ prisma native query engine');
}

// 检查关键依赖是否存在
const criticalDeps = ['express', 'cors', '@prisma/client', 'bcrypt', 'dotenv', 'ws', 'ioredis'];
for (const dep of criticalDeps) {
  const depDir = path.join(BUNDLE_DIR, 'node_modules', dep);
  if (!fs.existsSync(depDir)) {
    console.error(`  ❌ 缺少关键依赖: ${dep}`);
    allGood = false;
  } else {
    log(`  ✓ ${dep}`);
  }
}

if (!allGood) {
  fatal('bundle 完整性验证失败');
}

// ── 9. 统计 bundle 大小 ─────────────────────────────────────────────
const getBundleSize = (dir) => {
  let total = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else {
        total += fs.statSync(p).size;
      }
    }
  };
  walk(dir);
  return total;
};

const sizeMB = (getBundleSize(BUNDLE_DIR) / (1024 * 1024)).toFixed(1);
log(`✅ bundle 完成: ${BUNDLE_DIR} (${sizeMB} MB)`);
