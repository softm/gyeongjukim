import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// A dependency-free, explicitly ordered bundle for this app's small ES modules.
// The deployed app continues to use its original modules; this is a download preview.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] || resolve(root,'preview.html'));
const names = ['data','domain','icons','community','admin','app'];
let bundle = '(function(){\nconst __modules = Object.create(null);\n';
for(const name of names) {
  let source = await readFile(resolve(root,`assets/${name}.js`),'utf8');
  const exports = [...source.matchAll(/^export\s+(?:const|let|function|class)\s+(\w+)/gm)].map(m=>m[1]);
  source = source.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/(\w+)\.js['"];?\s*$/gm,(_,symbols,module)=>`const {${symbols}} = __modules[${JSON.stringify(module)}];`);
  source = source.replace(/^export\s+(?=(?:const|let|function|class)\s)/gm,'');
  if(/^\s*(?:import|export)\s/m.test(source)) throw new Error(`미지원 모듈 구문: ${name}`);
  bundle += `__modules[${JSON.stringify(name)}] = (function(){\n${source}\nreturn {${exports.join(',')}};\n})();\n`;
}
bundle += '})();';
const css = await readFile(resolve(root,'assets/style.css'),'utf8');
let html = await readFile(resolve(root,'index.html'),'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/,()=>`<style>${css}</style>`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/,'');
html = html.replace(/<script type="module" src="\.\/assets\/app\.js"><\/script>/,()=>`<script>${bundle.replaceAll('</script','<\\/script')}</script>`);
for(const filename of ['icon.svg','heritage.svg']) {
  const content = await readFile(resolve(root,'assets',filename));
  html = html.replaceAll(`./assets/${filename}`,`data:image/svg+xml;base64,${content.toString('base64')}`);
}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html);
console.log(`단일 HTML 생성: ${output}`);
