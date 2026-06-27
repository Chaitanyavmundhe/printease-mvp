const fs = require('fs');

const razorpayExports = ['createRazorpayOrder', 'verifyRazorpayPayment', 'createRazorpayUpiQr', 'razorpayWebhook'];
const manualExports = ['getPaymentConfig', 'createManualPaymentRequest'];
const demoExports = ['verifyDemoPayment'];

function cleanFile(filePath, keepExports) {
  let code = fs.readFileSync(filePath, 'utf8');
  const regex = /export const ([a-zA-Z0-9_]+)/g;
  code = code.replace(regex, (match, name) => {
    if (keepExports.includes(name)) return match;
    return `const ${name}`; // Removes the export!
  });
  fs.writeFileSync(filePath, code);
}

cleanFile('src/controllers/payment/razorpayController.js', razorpayExports);
cleanFile('src/controllers/payment/manualPaymentController.js', manualExports);
cleanFile('src/controllers/payment/demoPaymentController.js', demoExports);

console.log("Payment exports stripped.");
