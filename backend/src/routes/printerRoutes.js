import express from 'express';
import {
  addPrinter,
  getMyCentrePrinters,
  printOrder,
  testPrint,
  updatePrinterProtocol,
  updatePrinterStatus
} from '../controllers/printerController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authMiddleware, roleMiddleware('centre'));

router.post('/', addPrinter);
router.get('/mine', getMyCentrePrinters);
router.patch('/:id/status', updatePrinterStatus);
router.patch('/:id/protocol', updatePrinterProtocol);
router.post('/:id/test-print', testPrint);
router.post('/:printerId/print-order/:orderId', printOrder);

export default router;
