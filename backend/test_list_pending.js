import fs from 'fs';
const code = fs.readFileSync('src/db/repository.js', 'utf8');
const match = code.match(/export async function listPendingPaymentOrderFilesForAgentPredownload[\s\S]*?return result/m);
console.log(match ? match[0] : 'not found');
