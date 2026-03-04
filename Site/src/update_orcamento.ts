import fs from 'fs';

const filePath = 'c:/Desenvolvimento/SiteHugo/Site/src/pages/Orcamento.tsx';
let buf = fs.readFileSync(filePath, 'utf8');

// Replace product type detection
buf = buf.replace(
    "const pType = p.type_product || 'product';",
    "const pType = p.type_product || p.tipo_produto || 'product';"
);

// Replace icons/badge logic
buf = buf.replace(
    /p\.type_product === 'service'\s+\?\s+'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500\/30'\s+:\s+'bg-amber-500 border-amber-400 text-slate-900 shadow-lg shadow-amber-500\/30'/g,
    "(p.type_product === 'service' || p.tipo_produto === 'service') ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/30' : 'bg-amber-500 border-amber-400 text-slate-900 shadow-lg shadow-amber-500/30'"
);

buf = buf.replace(
    /p\.type_product === 'service'\s+\?\s+'🛠 '\s+:\s+'📦 '/g,
    "(p.type_product === 'service' || p.tipo_produto === 'service') ? '🛠 ' : '📦 '"
);

fs.writeFileSync(filePath, buf);
console.log('Update Complete on Orcamento.tsx');
