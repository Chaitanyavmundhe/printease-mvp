import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Only PDF files are supported for agent printing MVP');
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});
