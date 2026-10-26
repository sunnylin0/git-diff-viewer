import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const CACHE_DIR = path.resolve(__dirname, '../cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const PORT = parseInt(process.env.PORT || '3030', 10);
const DEFAULT_REPO = 'c:\\GitHub\\ai\\abcjs_663';

function getCacheFilePath(repo: string, exclude: string): string {
  const hash = crypto.createHash('sha256').update(`${repo}::${exclude}`).digest('hex').slice(0, 12);
  return path.join(CACHE_DIR, `commits_${hash}.json`);
}

function parseExcludeTokens(input: string): string[] {
  if (!input || !input.trim()) return [];
  const matches = input.match(/'[^']*'|"[^"]*"|\S+/g) || [];
  return matches
    .map(t => t.replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const fullArgs = ['--no-pager', ...args];
    const child = spawn('git', fullArgs, {
      cwd,
      windowsHide: true,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', err => {
      reject(err);
    });

    child.on('close', code => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

export interface CommitNode {
  fullDate: string;
  date: string;
  commitId: string;
  message: string;
  files: number;
  insertions: number;
  deletions: number;
  formattedLeft: string;
}

function parseGitLog(output: string): CommitNode[] {
  const lines = output.split(/\r?\n/);
  const commits: CommitNode[] = [];
  let currentCommit: CommitNode | null = null;

  const headerRegex = /^(\d{8}_\d{4})\s+([0-9a-fA-F]{7,40})\s*(.*)$/;

  for (const line of lines) {
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      if (currentCommit) {
        currentCommit.formattedLeft = `${currentCommit.date}, ${currentCommit.commitId}, ${currentCommit.message || '(no message)'}, ${currentCommit.files}(files), ${currentCommit.insertions}(+), ${currentCommit.deletions}(-)`;
        commits.push(currentCommit);
      }
      const fullDate = headerMatch[1];
      const date = fullDate.split('_')[0];
      const commitId = headerMatch[2];
      const message = headerMatch[3] ? headerMatch[3].trim() : '';

      currentCommit = {
        fullDate,
        date,
        commitId,
        message,
        files: 0,
        insertions: 0,
        deletions: 0,
        formattedLeft: ''
      };
      continue;
    }

    if (currentCommit && line.includes('changed')) {
      const filesMatch = line.match(/(\d+)\s+files?\s+changed/);
      if (filesMatch) currentCommit.files = parseInt(filesMatch[1], 10);

      const insMatch = line.match(/(\d+)\s+insertions?\s*\(\+\)/);
      if (insMatch) currentCommit.insertions = parseInt(insMatch[1], 10);

      const delMatch = line.match(/(\d+)\s+deletions?\s*\(-\)/);
      if (delMatch) currentCommit.deletions = parseInt(delMatch[1], 10);
    }
  }

  if (currentCommit) {
    currentCommit.formattedLeft = `${currentCommit.date}, ${currentCommit.commitId}, ${currentCommit.message || '(no message)'}, ${currentCommit.files}(files), ${currentCommit.insertions}(+), ${currentCommit.deletions}(-)`;
    commits.push(currentCommit);
  }

  // 由遠到近 (Oldest to Newest)
  return commits.reverse();
}

function parseStatLine(output: string): { files: number; insertions: number; deletions: number } {
  let files = 0;
  let insertions = 0;
  let deletions = 0;

  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    if (line.includes('changed')) {
      const filesMatch = line.match(/(\d+)\s+files?\s+changed/);
      if (filesMatch) files = parseInt(filesMatch[1], 10);

      const insMatch = line.match(/(\d+)\s+insertions?\s*\(\+\)/);
      if (insMatch) insertions = parseInt(insMatch[1], 10);

      const delMatch = line.match(/(\d+)\s+deletions?\s*\(-\)/);
      if (delMatch) deletions = parseInt(delMatch[1], 10);
    }
  }
  return { files, insertions, deletions };
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const commitsCache = new Map<string, { commits: CommitNode[]; timestamp: number }>();

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/commits') {
      const repo = reqUrl.searchParams.get('repo') || DEFAULT_REPO;
      const excludeRaw = reqUrl.searchParams.get('exclude') || '';
      const force = reqUrl.searchParams.get('force') === 'true';
      const cacheFile = getCacheFilePath(repo, excludeRaw);

      // 1. 檢查磁碟 JSON 快取檔案是否存在
      if (!force && fs.existsSync(cacheFile)) {
        try {
          const raw = fs.readFileSync(cacheFile, 'utf-8');
          const cacheData = JSON.parse(raw);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            count: cacheData.commits.length,
            commits: cacheData.commits,
            fromCache: true,
            cacheFile: path.basename(cacheFile),
            cachedAt: cacheData.createdAt
          }));
          return;
        } catch (readErr) {
          console.warn('讀取快取檔案失敗，重新執行 git log:', readErr);
        }
      }

      // 2. 快取不存在或 force=true，執行本機 git log
      const excludeTokens = parseExcludeTokens(excludeRaw);
      const gitArgs = [
        '-C', repo,
        'log',
        '--date=format:%Y%m%d_%H%M',
        '--format=%cd %h %s',
        '--shortstat',
        '--',
        '.',
        ...excludeTokens
      ];

      const { stdout, stderr, code } = await runGit(gitArgs, repo);
      if (code !== 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: stderr || 'git log failed' }));
        return;
      }

      const commits = parseGitLog(stdout);

      // 3. 寫入磁碟 JSON 快取檔案
      try {
        const payload = {
          repo,
          exclude: excludeRaw,
          createdAt: new Date().toISOString(),
          commits
        };
        fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), 'utf-8');
      } catch (writeErr) {
        console.warn('寫入快取檔案失敗:', writeErr);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: commits.length,
        commits,
        fromCache: false,
        cacheFile: path.basename(cacheFile)
      }));
      return;
    }

    if (pathname === '/api/show') {
      const repo = reqUrl.searchParams.get('repo') || DEFAULT_REPO;
      const commit = reqUrl.searchParams.get('commit');
      const excludeRaw = reqUrl.searchParams.get('exclude') || '';

      if (!commit) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing commit parameter' }));
        return;
      }

      const excludeTokens = parseExcludeTokens(excludeRaw);
      const gitArgs = [
        '-C', repo,
        'show',
        '--stat',
        commit,
        '--',
        '.',
        ...excludeTokens
      ];

      const { stdout, stderr, code } = await runGit(gitArgs, repo);
      if (code !== 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: stderr || 'git show failed' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, commit, rawOutput: stdout }));
      return;
    }

    if (pathname === '/api/diff') {
      const repo = reqUrl.searchParams.get('repo') || DEFAULT_REPO;
      const from = reqUrl.searchParams.get('from');
      const to = reqUrl.searchParams.get('to');
      const excludeRaw = reqUrl.searchParams.get('exclude') || '';

      if (!from || !to) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing from or to parameter' }));
        return;
      }

      const excludeTokens = parseExcludeTokens(excludeRaw);
      const gitArgs = [
        '-C', repo,
        'diff',
        '--stat',
        from,
        to,
        '--',
        '.',
        ...excludeTokens
      ];

      const { stdout, stderr, code } = await runGit(gitArgs, repo);
      if (code !== 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: stderr || 'git diff failed' }));
        return;
      }

      const stats = parseStatLine(stdout);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        from,
        to,
        files: stats.files,
        insertions: stats.insertions,
        deletions: stats.deletions,
        rawStat: stdout
      }));
      return;
    }

    // Static files
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Git Diff Viewer server running at http://localhost:${PORT}`);
  console.log(`Target Repo: ${DEFAULT_REPO}`);
});
