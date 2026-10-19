import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
createServer(async (req,res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Serve both root and the actual Pages project prefix for local verification.
    if (path.startsWith('/gyeongjukim/')) path = path.slice('/gyeongjukim'.length);
    if (path === '/') path = '/index.html';
    const target = resolve(root, '.' + path);
    if (!target.startsWith(root.endsWith(sep) ? root : root+sep) || !(await stat(target)).isFile()) throw new Error('not found');
    const body = await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('파일을 찾을 수 없습니다.');}
}).listen(port,'0.0.0.0',()=>console.log(`미리보기: http://localhost:${port}/`));
