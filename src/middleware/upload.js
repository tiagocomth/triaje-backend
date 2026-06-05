import multer from 'multer';
import config from '../config/index.js';
import AppError from '../utils/AppError.js';

/**
 * Multer config for CV uploads (spec §2.3):
 *   - in-memory storage (the service writes the buffer to disk itself)
 *   - 10 MB size limit
 *   - only PDF and DOCX MIME types accepted
 *
 * Rejected types are reported via AppError(415); the size limit surfaces as a
 * Multer LIMIT_FILE_SIZE error, mapped to 413 in the error handler.
 */
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
  fileFilter(req, file, cb) {
    if (config.uploads.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(415, 'Unsupported file type'));
    }
  },
});

/** Express middleware accepting a single `file` field. */
export const uploadSingleCv = multerUpload.single('file');

export default uploadSingleCv;
