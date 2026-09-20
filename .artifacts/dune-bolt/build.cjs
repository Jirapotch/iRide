const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const esbuild=require('../../node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild');
const library=esbuild.buildSync({stdin:{contents:"globalThis.THREE = require('./three.cjs');",resolveDir:root},bundle:true,write:false,minify:true,format:'iife',platform:'browser',target:'es2020',legalComments:'inline'}).outputFiles[0].text;
let shell=fs.readFileSync(path.join(root,'shell.html'),'utf8');
const inline=s=>'<script>\n'+s.replace(/<\/script/gi,'<\\/script')+'\n</script>';
const license='/* Three.js 0.180.0\n'+fs.readFileSync(path.join(root,'THREE-LICENSE.txt'),'utf8')+'\n*/\n';
shell=shell.replace('<!--LIBRARY-->',inline(license+library)).replace('<!--CORE-->',inline(fs.readFileSync(path.join(root,'core.js'),'utf8'))).replace('<!--RENDERER-->',inline(fs.readFileSync(path.join(root,'renderer.js'),'utf8'))).replace('<!--UI-->',inline(fs.readFileSync(path.join(root,'ui.js'),'utf8'))+inline(fs.readFileSync(path.join(root,'boot.js'),'utf8')));
const dest=path.resolve(root,'../../dune-bolt-racing/index.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,shell);console.log(dest,fs.statSync(dest).size,'bytes');
