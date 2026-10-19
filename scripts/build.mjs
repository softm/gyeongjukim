import { cp, lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const entries = ['index.html', 'assets', 'manifest.webmanifest'];

async function verifySource(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) {
    throw new Error(`심볼릭 링크는 배포하지 않습니다: ${relative(root, path)}`);
  }
  if (stat.isDirectory()) {
    for (const entry of await readdir(path)) {
      if (entry.startsWith('.')) {
        throw new Error(`assets 안의 숨김 파일을 제거하거나 옮겨 주세요: ${relative(root, join(path, entry))}`);
      }
      await verifySource(join(path, entry));
    }
  } else if (!stat.isFile()) {
    throw new Error(`일반 파일이 아닙니다: ${relative(root, path)}`);
  }
}

try {
  // Verify the explicit public inputs before replacing a previous build.
  // Every file inside assets/ is public; keep real member data outside this repository.
  for (const entry of entries) await verifySource(join(root, entry));
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const entry of entries) {
    await cp(join(root, entry), join(output, entry), { recursive: true });
  }
  await writeFile(join(output, '.nojekyll'), '');
  console.log('배포 파일 생성: dist/ (index.html, assets/, manifest.webmanifest, .nojekyll)');
} catch (error) {
  console.error(`빌드 실패: ${error.message}`);
  process.exitCode = 1;
}
