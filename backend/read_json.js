import fs from 'fs';
const raw = fs.readFileSync('tmp_out.json', 'utf16le');
console.log(raw.substring(0, 1000));
