import multer from 'multer';
import {
  MAX_UPLOAD_SIZE_BYTES,
  formatAllowedUploadTypes,
  isAllowedUploadMimeType
} from '../constants/upload.js';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 2,
    fields: 16,
    parts: 18,
    fieldSize: 4096,
    fieldNameSize: 100
  },
  fileFilter: (req, file, cb) => {
    if (!isAllowedUploadMimeType(file.mimetype)) {
      const error = new Error(`Unsupported file type. Allowed types: ${formatAllowedUploadTypes()}`);
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});
