export function sendOrderToPrinter({ printer, order }) {
  if (order.paymentStatus !== 'verified') {
    return {
      message: 'Order cannot be printed because payment is not verified',
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

  order.status = 'Printing';
  printer.status = 'printing';

  return {
    message: 'Order sent to printer simulation successfully',
    printable: true,
    order,
    printer,
    note: 'For production, integrate CUPS, IPP, or a local print agent.'
  };
}
