import fs from 'fs';

const filePath = 'c:/Desenvolvimento/SiteHugo/Site/src/pages/Orcamento.tsx';
const buf = fs.readFileSync(filePath);
const target = Buffer.from("const pType = p.type_product || 'product';");
const idx = buf.indexOf(target);

if (idx !== -1) {
    console.log('Found it at index:', idx);
    const context = buf.slice(idx - 100, idx + 100);
    console.log('HEX context:\n', context.toString('hex').match(/.{1,32}/g)?.join('\n'));
    console.log('UTF8 context:\n', context.toString('utf8'));
} else {
    console.log('NotFound! Maybe different spacing?');
}
