import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const problems = [];
const localReferences = new Set();
let checkedScripts = 0;
const referencesOnly = process.argv.includes('--references-only');

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      problems.push(`심볼릭 링크는 배포할 수 없습니다: ${relative(root, path)}`);
    } else if (entry.isDirectory()) {
      paths.push(...await walk(path));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

async function checkReference(value, source) {
  if (!value || /^(?:#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return;
  const sourceName = relative(root, source);
  if (value.startsWith('/')) {
    problems.push(`${sourceName}: 프로젝트 경로에서 깨지는 절대 경로 ${value}`);
    return;
  }
  let clean;
  try {
    clean = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  } catch {
    problems.push(`${sourceName}: 잘못된 URL 인코딩 ${value}`);
    return;
  }
  if (!clean) return;
  const target = resolve(source, '..', clean);
  const withinRoot = relative(root, target);
  if (withinRoot === '..' || withinRoot.startsWith(`..${sep}`)) {
    problems.push(`${sourceName}: 프로젝트 외부 참조 ${value}`);
    return;
  }
  localReferences.add(target);
  try {
    const stat = await lstat(target);
    if (stat.isDirectory()) await lstat(join(target, 'index.html'));
    if (stat.isSymbolicLink()) throw new Error('symlink');
  } catch {
    problems.push(`${sourceName}: 로컬 파일을 찾을 수 없습니다: ${value}`);
  }
}

try {
  const htmlPath = join(root, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  if (!/<html\b[^>]*\blang\s*=\s*["']ko["']/i.test(html)) {
    problems.push('index.html: 문서 언어 lang="ko"가 필요합니다.');
  }
  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    problems.push('index.html: 모바일 viewport 설정이 필요합니다.');
  }
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    await checkReference(match[1], htmlPath);
  }

  const assetFiles = await walk(join(root, 'assets'));
  const scriptFiles = [
    ...assetFiles.filter(path => /\.(?:m?js)$/.test(path)),
    ...await walk(join(root, 'scripts')),
    ...await walk(join(root, 'tests')),
  ].filter(path => /\.(?:m?js)$/.test(path));

  for (const path of scriptFiles) {
    if (referencesOnly) continue;
    try {
      execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
      checkedScripts += 1;
    } catch (error) {
      problems.push(`${relative(root, path)}: ${error.code === 'EPERM' ? '검사 프로세스 실행 제한. 각 파일의 node --check를 별도 실행하고 --references-only로 참조를 검사하세요.' : 'JavaScript 구문 검사 실패'}\n${String(error.stderr || '').trim()}`);
    }
  }

  for (const path of assetFiles) {
    if (!['.js', '.mjs', '.css'].includes(extname(path))) continue;
    const source = await readFile(path, 'utf8');
    if (extname(path) === '.css') {
      for (const match of source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
        await checkReference(match[1], path);
      }
    } else {
      const imports = /(?:\b(?:import|export)\s+[\w*\s{},]*\s+from\s*|\bimport\s*)["']([^"']+)["']/g;
      for (const match of source.matchAll(imports)) {
        if (match[1].startsWith('.')) await checkReference(match[1], path);
      }
    }
  }

  const manifestPath = join(root, 'manifest.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest.name || !manifest.short_name) problems.push('manifest: name과 short_name이 필요합니다.');
  for (const field of ['start_url', 'scope']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].startsWith('./')) {
      problems.push(`manifest: ${field}는 ./로 시작하는 프로젝트 상대 경로여야 합니다.`);
    } else {
      await checkReference(manifest[field], manifestPath);
    }
  }
  for (const icon of manifest.icons || []) await checkReference(icon.src, manifestPath);

  if (problems.length > 0) {
    console.error(`정적 검사 실패 (${problems.length}건)\n${problems.map(problem => `- ${problem}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`정적 검사 통과: ${referencesOnly ? '참조 검사 모드 (JS 구문 검사는 별도 실행 필요)' : `JavaScript ${checkedScripts}개`}, 로컬 참조 ${localReferences.size}개, 모바일 문서·manifest 경로`);
  }
} catch (error) {
  console.error(`정적 검사 실패: ${error.message}`);
  process.exitCode = 1;
}
