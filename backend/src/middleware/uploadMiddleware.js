import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Only PDF, PNG, and JPG files are allowed');
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});
