import {
  createPrinter,
  findOrderByIdOrCode,
  findPrinterByIdAndCentre,
  listPrintersByCentre,
  updatePrinterProtocol as savePrinterProtocol,
  updatePrinterStatus as savePrinterStatus
} from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { sendOrderToPrinter } from '../services/printerService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const addPrinter = asyncHandler(async (req, res) => {
  const centreId = req.user.centreId;

  if (!centreId) {
    return res.status(400).json({ success: false, message: 'Logged in user is not linked to a centre' });
  }

  const {
    printerName,
    printerType = 'laser',
    protocol = 'PDF_MANUAL_DOWNLOAD',
    ipAddress = '',
    port = null
  } = req.body;

  if (!printerName) {
    return res.status(400).json({ success: false, message: 'Printer name is required' });
  }

  const printer = await createPrinter({
    id: generateId('printer'),
    centreId,
    printerName,
    printerType,
    protocol,
    ipAddress,
    port,
    status: 'offline',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({ success: true, message: 'Printer added successfully', printer });
});

export const getMyCentrePrinters = asyncHandler(async (req, res) => {
  const printers = await listPrintersByCentre(req.user.centreId);
  res.json({ success: true, printers });
});

export const updatePrinterStatus = asyncHandler(async (req, res) => {
  const printer = await savePrinterStatus(req.params.id, req.user.centreId, req.body.status);

  if (!printer) {
    return res.status(404).json({ success: false, message: 'Printer not found' });
  }

  res.json({ success: true, message: 'Printer status updated', printer });
});

export const updatePrinterProtocol = asyncHandler(async (req, res) => {
  const printer = await savePrinterProtocol(req.params.id, req.user.centreId, req.body);

  if (!printer) {
    return res.status(404).json({ success: false, message: 'Printer not found' });
  }

  res.json({ success: true, message: 'Printer protocol updated', printer });
});

export const testPrint = asyncHandler(async (req, res) => {
  const printer = await findPrinterByIdAndCentre(req.params.id, req.user.centreId);

  if (!printer) {
    return res.status(404).json({ success: false, message: 'Printer not found' });
  }

  res.json({
    success: true,
    message: 'Test print simulated successfully',
    printer,
    note: 'MVP uses simulated printer control. Real CUPS/IPP integration can be added later.'
  });
});

export const printOrder = asyncHandler(async (req, res) => {
  const printer = await findPrinterByIdAndCentre(req.params.printerId, req.user.centreId);

  if (!printer) {
    return res.status(404).json({ success: false, message: 'Printer not found' });
  }

  const order = await findOrderByIdOrCode(req.params.orderId);

  if (!order || order.centreId !== req.user.centreId) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const result = sendOrderToPrinter({ printer, order });

  res.json({ success: true, ...result });
});
