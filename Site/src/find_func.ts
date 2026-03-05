import fs from 'fs';

const filePath = 'c:/Desenvolvimento/SiteHugo/Site/src/pages/Orcamento.tsx';
const buf = fs.readFileSync(filePath, 'utf8');
const lines = buf.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleConfirmService =')) {
        console.log(`Found handleConfirmService at line ${i + 1}`);
        console.log(lines.slice(i, i + 10).join('\n'));
    }
}
