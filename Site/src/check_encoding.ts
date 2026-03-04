import fs from 'fs';
import path from 'path';

const filePath = 'c:/Desenvolvimento/SiteHugo/Site/src/pages/Orcamento.tsx';
const buf = fs.readFileSync(filePath);
console.log('File size:', buf.length);
console.log('First 64 bytes:', buf.slice(0, 64).toString('hex'));
console.log('UTF-8 text?', buf.slice(0, 64).toString('utf8'));
