export function sendOrderToPrinter({ printer, order }) {
  if (order.paymentStatus !== 'collected') {
    return {
      message: 'Order cannot be printed because payment is not collected',
      printable: false,
      order
    };
  }

  if (printer.status !== 'online') {
    return {
      message: 'Printer is not online. Centre can manually download PDF for MVP.',
      printable: false,
      order,
      printer
    };
  }

  return {
    message: 'Order sent to printer simulation successfully',
    printable: true,
    orderStatus: 'Printing',
    printerStatus: 'printing',
    note: 'For production, integrate CUPS, IPP, or a local print agent.'
  };
}
