import fs from 'fs';

// Fix systemController.js
const sysCtrlPath = 'src/controllers/systemController.js';
let sysCtrlCode = fs.readFileSync(sysCtrlPath, 'utf8');
sysCtrlCode = sysCtrlCode.replace(
  `    await pool.query(
      \`DELETE FROM print_order_files WHERE document_id = ANY($1::uuid[])\`,
      [documentIds]
    );`,
  `    await pool.query(
      \`DELETE FROM print_job_files WHERE document_id = ANY($1::uuid[])\`,
      [documentIds]
    );

    await pool.query(
      \`DELETE FROM print_order_files WHERE document_id = ANY($1::uuid[])\`,
      [documentIds]
    );`
);
fs.writeFileSync(sysCtrlPath, sysCtrlCode);

// Fix paymentController.js
const payCtrlPath = 'src/controllers/paymentController.js';
let payCtrlCode = fs.readFileSync(payCtrlPath, 'utf8');
payCtrlCode = payCtrlCode.replace(
  `async function assertOrderIsFullyPrepared(orderId) {
  const files = await listOrderFiles(orderId);`,
  `async function assertOrderIsFullyPrepared(order) {
  if (order.status === 'bill_confirmed') return;
  const files = await listOrderFiles(order.id);`
);

// Update calls to pass `order` instead of `order.id`
payCtrlCode = payCtrlCode.replace(/await assertOrderIsFullyPrepared\(order\.id\);/g, 'await assertOrderIsFullyPrepared(order);');
fs.writeFileSync(payCtrlPath, payCtrlCode);

console.log('Fixed systemController.js and paymentController.js');
