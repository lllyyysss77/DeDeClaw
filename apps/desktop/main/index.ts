import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { spawn, type ChildProcess } from 'child_process';

const IPC_CHANNELS = {
  pdfExport: 'ipc:pdf:export',
  openExternal: 'ipc:shell:openExternal',
} as const;

const API_HEALTH_CHECK_INTERVAL_MS = 600;
const API_HEALTH_CHECK_TIMEOUT_MS = 20_000;
const DB_HEALTH_CHECK_INTERVAL_MS = 600;
const DB_HEALTH_CHECK_TIMEOUT_MS = 20_000;
const PACKAGED_DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080';
const PACKAGED_DEFAULT_DATABASE_URL = 'postgresql://devai@127.0.0.1:5432/dede';
const PACKAGED_DEFAULT_API_PORT = '8080';
const PACKAGED_DEFAULT_ADMIN_PORT = '5180';
const PACKAGED_DEFAULT_DESKTOP_PORT = '5173';

let apiServerProcess: ChildProcess | null = null;
let postgresProcess: ChildProcess | null = null;
const POSTGRES_DATA_SENTINEL_FILE = 'PG_VERSION';

const ensureDir = (targetDir: string): void => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
};

const hasInitializedPostgresData = (dataDir: string): boolean => {
  const sentinelPath = path.join(dataDir, POSTGRES_DATA_SENTINEL_FILE);
  return fs.existsSync(sentinelPath);
};

const preparePackagedPostgresDataDir = (seedDataDir: string, targetDataDir: string): void => {
  if (hasInitializedPostgresData(targetDataDir)) {
    return;
  }

  if (!fs.existsSync(seedDataDir)) {
    throw new Error('[Desktop Main] 缺少 PostgreSQL 初始化模板：resources/postgres/data');
  }

  ensureDir(path.dirname(targetDataDir));
  fs.cpSync(seedDataDir, targetDataDir, { recursive: true, force: false });

  if (!hasInitializedPostgresData(targetDataDir)) {
    throw new Error('[Desktop Main] PostgreSQL 数据目录初始化失败，请检查 resources/postgres/data 是否完整');
  }
};

const resolveEnvPath = (): string | null => {
  const candidatePaths = [
    path.resolve(__dirname, '../../../../.env.local'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  const matchedPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
  return matchedPath ?? null;
};

const readEnvValue = (filePath: string, key: string): string | null => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) {
      continue;
    }

    const currentKey = line.slice(0, equalIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    const rawValue = line.slice(equalIndex + 1).trim();
    if (rawValue.length === 0) {
      return null;
    }

    const hasDoubleQuotes = rawValue.startsWith('"') && rawValue.endsWith('"');
    const hasSingleQuotes = rawValue.startsWith('\'') && rawValue.endsWith('\'');

    if (hasDoubleQuotes || hasSingleQuotes) {
      return rawValue.slice(1, -1).trim();
    }

    return rawValue;
  }

  return null;
};

const resolvePostgresStartupConfig = (): { pgCtlPath: string; dataDir: string } | null => {
  const envPgCtlPath = process.env.DESKTOP_PG_CTL_PATH;
  const envPgDataDir = process.env.DESKTOP_PG_DATA_DIR;

  if (envPgCtlPath && envPgDataDir) {
    return {
      pgCtlPath: envPgCtlPath,
      dataDir: envPgDataDir,
    };
  }

  if (!app.isPackaged) {
    return null;
  }

  const pgCtlFileName = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl';
  const packagedPgCtlPath = path.join(process.resourcesPath, 'postgres', 'bin', pgCtlFileName);
  const packagedPgSeedDataDir = path.join(process.resourcesPath, 'postgres', 'data');
  const persistentPgDataDir = path.join(app.getPath('userData'), 'postgres', 'data');

  if (!fs.existsSync(packagedPgCtlPath)) {
    return null;
  }

  preparePackagedPostgresDataDir(packagedPgSeedDataDir, persistentPgDataDir);

  return {
    pgCtlPath: packagedPgCtlPath,
    dataDir: persistentPgDataDir,
  };

};

const requireDesktopPort = (): number => {
  const fromProcessEnv = process.env.VITE_DESKTOP_PORT;
  const envPath = resolveEnvPath();
  const fromEnvFile = envPath ? readEnvValue(envPath, 'VITE_DESKTOP_PORT') : null;
  const rawValue = fromProcessEnv && fromProcessEnv.trim().length > 0 ? fromProcessEnv : fromEnvFile;

  if (!rawValue || rawValue.trim().length === 0) {
    if (app.isPackaged) {
      return Number(PACKAGED_DEFAULT_DESKTOP_PORT);
    }
    throw new Error('[Desktop Main] 缺少必要环境变量：VITE_DESKTOP_PORT');
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('[Desktop Main] VITE_DESKTOP_PORT 必须为大于 0 的数字');
  }

  return parsed;
};

const requireApiBaseUrl = (): string => {
  const fromProcessEnv = process.env.VITE_API_BASE_URL;
  const envPath = resolveEnvPath();
  const fromEnvFile = envPath ? readEnvValue(envPath, 'VITE_API_BASE_URL') : null;
  const rawValue = fromProcessEnv && fromProcessEnv.trim().length > 0 ? fromProcessEnv : fromEnvFile;

  if (!rawValue || rawValue.trim().length === 0) {
    if (app.isPackaged) {
      return PACKAGED_DEFAULT_API_BASE_URL;
    }
    throw new Error('[Desktop Main] 缺少必要环境变量：VITE_API_BASE_URL');
  }

  return rawValue;
};

const requireDatabaseUrl = (): string => {
  const fromProcessEnv = process.env.DATABASE_URL;
  const envPath = resolveEnvPath();
  const fromEnvFile = envPath ? readEnvValue(envPath, 'DATABASE_URL') : null;
  const rawValue = fromProcessEnv && fromProcessEnv.trim().length > 0 ? fromProcessEnv : fromEnvFile;

  if (!rawValue || rawValue.trim().length === 0) {
    if (app.isPackaged) {
      return PACKAGED_DEFAULT_DATABASE_URL;
    }
    throw new Error('[Desktop Main] 缺少必要环境变量：DATABASE_URL');
  }

  return rawValue;
};

const parseDatabaseConnection = (databaseUrl: string): { host: string; port: number } => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('[Desktop Main] DATABASE_URL 格式不合法');
  }

  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || '5432');

  if (!host || !Number.isFinite(port) || port <= 0) {
    throw new Error('[Desktop Main] DATABASE_URL 中的数据库地址不合法');
  }

  return { host, port };
};

const checkDatabaseHealth = async (host: string, port: number): Promise<boolean> => {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(1_500);

    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.once('error', () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, host);
  });
};

const waitForDatabaseHealth = async (host: string, port: number, timeoutMs: number): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const healthy = await checkDatabaseHealth(host, port);
    if (healthy) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, DB_HEALTH_CHECK_INTERVAL_MS));
  }
  return false;
};

const startPostgresIfConfigured = async (): Promise<void> => {
  const databaseUrl = requireDatabaseUrl();
  const { host, port } = parseDatabaseConnection(databaseUrl);
  const alreadyRunning = await checkDatabaseHealth(host, port);
  if (alreadyRunning) {
    return;
  }

  const startupConfig = resolvePostgresStartupConfig();
  if (!startupConfig) {
    throw new Error('[Desktop Main] PostgreSQL 未运行。请先启动本地 PostgreSQL，或配置 DESKTOP_PG_CTL_PATH 与 DESKTOP_PG_DATA_DIR；打包环境需提供 resources/postgres/bin 与 resources/postgres/data 初始化模板。');
  }

  postgresProcess = spawn(startupConfig.pgCtlPath, ['start', '-D', startupConfig.dataDir, '-w'], {
    shell: process.platform === 'win32',
    stdio: 'ignore',
  });

  const healthy = await waitForDatabaseHealth(host, port, DB_HEALTH_CHECK_TIMEOUT_MS);
  if (!healthy) {
    throw new Error('[Desktop Main] PostgreSQL 启动超时，请检查本地数据库状态');
  }
};

const checkApiHealth = async (apiBaseUrl: string): Promise<boolean> => {
  try {
    const target = new URL('/health', apiBaseUrl).toString();
    const response = await fetch(target, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

const waitForApiHealth = async (apiBaseUrl: string, timeoutMs: number): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const healthy = await checkApiHealth(apiBaseUrl);
    if (healthy) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, API_HEALTH_CHECK_INTERVAL_MS));
  }
  return false;
};

const resolveRepoRoot = (): string => {
  return path.resolve(__dirname, '../../../../');
};

const resolvePackagedApiDir = (): string | null => {
  const apiDir = path.join(process.resourcesPath, 'api-server');
  const apiEntryPath = path.join(apiDir, 'dist', 'index.js');
  if (fs.existsSync(apiEntryPath)) {
    return apiDir;
  }

  return null;
};

const startApiServerIfNeeded = async (): Promise<void> => {
  const apiBaseUrl = requireApiBaseUrl();
  const alreadyRunning = await checkApiHealth(apiBaseUrl);
  if (alreadyRunning) {
    return;
  }

  if (app.isPackaged) {
    const packagedApiDir = resolvePackagedApiDir();
    if (!packagedApiDir) {
      throw new Error('[Desktop Main] API 服务未运行（未找到打包产物 resources/api-server/dist/index.js）');
    }

    const packagedApiEntry = path.join(packagedApiDir, 'dist', 'index.js');

    const libraryStoragePath = path.join(app.getPath('userData'), 'library_files');

    apiServerProcess = spawn(process.execPath, [packagedApiEntry], {
      cwd: packagedApiDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DATABASE_URL: process.env.DATABASE_URL ?? PACKAGED_DEFAULT_DATABASE_URL,
        PORT: process.env.PORT ?? PACKAGED_DEFAULT_API_PORT,
        VITE_ADMIN_PORT: process.env.VITE_ADMIN_PORT ?? PACKAGED_DEFAULT_ADMIN_PORT,
        VITE_DESKTOP_PORT: process.env.VITE_DESKTOP_PORT ?? PACKAGED_DEFAULT_DESKTOP_PORT,
        NODE_PATH: path.join(packagedApiDir, 'node_modules'),
        LIBRARY_STORAGE_PATH: libraryStoragePath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    apiServerProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[API Server] ${data.toString().trim()}`);
    });

    apiServerProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[API Server] ${data.toString().trim()}`);
    });

    apiServerProcess.on('error', (err) => {
      console.error('[API Server] 进程启动失败:', err.message);
    });

    apiServerProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        console.error(`[API Server] 进程异常退出 code=${code} signal=${signal}`);
      }
    });

    const healthy = await waitForApiHealth(apiBaseUrl, API_HEALTH_CHECK_TIMEOUT_MS);
    if (!healthy) {
      throw new Error('[Desktop Main] 打包环境 API 服务启动超时，请检查 API 产物');
    }

    return;
  }

  const repoRoot = resolveRepoRoot();
  apiServerProcess = spawn('pnpm', ['--filter', 'api-server', 'dev'], {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'ignore',
  });

  const healthy = await waitForApiHealth(apiBaseUrl, API_HEALTH_CHECK_TIMEOUT_MS);
  if (!healthy) {
    throw new Error('[Desktop Main] API 服务启动超时，请检查 api-server 日志');
  }
};

function createWindow() {
  const isWindows = process.platform === 'win32';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    ...(isWindows
      ? { autoHideMenuBar: true }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#000000',
            height: 40,
          },
        }),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
    return;
  }

  const desktopPort = requireDesktopPort();
  win.loadURL(`http://localhost:${desktopPort}`);
  
  // win.webContents.openDevTools();
}

// IPC: PDF 导出
ipcMain.handle(IPC_CHANNELS.pdfExport, async (event, { html, title }: { html: string; title: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: '窗口不存在' };

  // 弹出保存对话框
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '保存 PDF',
    defaultPath: `${title || '文章'}.pdf`,
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false, error: 'canceled' };

  // 写临时 HTML 文件，用 loadFile 加载（避免 data: URI 安全限制）
  const tmpFile = path.join(os.tmpdir(), `dede-pdf-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');

  const pdfWin = new BrowserWindow({ show: false });

  try {
    await new Promise<void>((resolve, reject) => {
      pdfWin.webContents.once('did-finish-load', () => resolve());
      pdfWin.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`${code}: ${desc}`)));
      pdfWin.loadFile(tmpFile);
    });

    // 等待渲染完成
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    fs.writeFileSync(filePath, pdfBuffer);
    return { success: true };
  } catch (err) {
    console.error('[PDF] printToPDF error:', err);
    return { success: false, error: String(err) };
  } finally {
    pdfWin.destroy();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
});

// IPC: 外链跳转（系统默认浏览器）
ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, rawUrl: string) => {
  try {
    const targetUrl = new URL(rawUrl);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return { success: false, error: '仅支持 http/https 链接' };
    }

    await shell.openExternal(targetUrl.toString());
    return { success: true };
  } catch {
    return { success: false, error: '无效链接' };
  }
});

app.whenReady().then(async () => {
  try {
    await startPostgresIfConfigured();
    await startApiServerIfNeeded();
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    dialog.showErrorBox('启动失败', message);
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (postgresProcess && !postgresProcess.killed) {
    postgresProcess.kill();
    postgresProcess = null;
  }

  if (!apiServerProcess || apiServerProcess.killed) {
    return;
  }

  apiServerProcess.kill();
  apiServerProcess = null;
});
