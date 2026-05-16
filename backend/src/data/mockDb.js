export const db = {
  users: [
    {
      id: 'user-1',
      name: 'Demo User',
      mobile: '9876543210',
      passwordHash: '$2a$10$UivK/fMiwE3SqsFyHQv7VOQnqnL2cOdp7Mj9/zdjwGz6N7sH0iDbW',
      role: 'user',
      createdAt: new Date().toISOString()
    },
    {
      id: 'hub-owner-1',
      name: 'Sai Owner',
      mobile: '9998887776',
      passwordHash: '$2a$10$UivK/fMiwE3SqsFyHQv7VOQnqnL2cOdp7Mj9/zdjwGz6N7sH0iDbW',
      role: 'hub',
      centreId: 'centre-1',
      createdAt: new Date().toISOString()
    }
  ],
  centres: [
    {
      id: 'centre-1',
      name: 'Sai Printing Hub',
      ownerId: 'hub-owner-1',
      centreCode: '2045',
      mobile: '9998887776',
      status: 'available',
      upiId: 'saiprint@upi',
      pricing: {
        bwSingle: 1,
        bwDouble: 1.5,
        colorSingle: 2,
        colorDouble: 3,
        watermarkCharge: 2
      },
      createdAt: new Date().toISOString()
    },
    {
      id: 'centre-2',
      name: 'College Xerox Centre',
      ownerId: null,
      centreCode: '7832',
      mobile: '8887776665',
      status: 'busy',
      upiId: 'collegeprint@upi',
      pricing: {
        bwSingle: 1,
        bwDouble: 1.5,
        colorSingle: 3,
        colorDouble: 4,
        watermarkCharge: 2
      },
      createdAt: new Date().toISOString()
    }
  ],
  printers: [
    {
      id: 'printer-1',
      centreId: 'centre-1',
      printerName: 'Main HP Laser Printer',
      printerType: 'laser',
      protocol: 'PDF_MANUAL_DOWNLOAD',
      ipAddress: '',
      port: null,
      status: 'online',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  documents: [],
  orders: [
    {
      id: 'order-1',
      orderCode: 'PRN-2045-8932',
      userId: 'user-1',
      centreId: 'centre-1',
      documentId: null,
      documentName: 'Assignment.pdf',
      pages: 12,
      copies: 1,
      colorType: 'color',
      sideType: 'single',
      watermarkEnabled: false,
      amount: 24,
      paymentStatus: 'verified',
      status: 'Ready for Pickup',
      pickupCode: '8932',
      createdAt: new Date().toISOString()
    }
  ],
  payments: []
};
