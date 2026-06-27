const fs = require('fs');

const creationExports = ['createOrder'];
const queryExports = ['getOrderDocuments', 'getOrderById', 'getMyOrders', 'getCentreOrders'];
const updateExports = ['collectCashPayment', 'updateOrderStatus', 'reprintOrder'];

function cleanFile(filePath, keepExports) {
  let code = fs.readFileSync(filePath, 'utf8');
  const regex = /export const ([a-zA-Z0-9_]+)/g;
  code = code.replace(regex, (match, name) => {
    if (keepExports.includes(name)) return match;
    return `const ${name}`; // Removes the export!
  });
  fs.writeFileSync(filePath, code);
}

cleanFile('src/controllers/order/orderCreationController.js', creationExports);
cleanFile('src/controllers/order/orderQueryController.js', queryExports);
cleanFile('src/controllers/order/orderUpdateController.js', updateExports);

console.log("Order exports stripped.");
