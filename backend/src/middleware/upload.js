const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");
const storage = require("../config/storage");

// Files are buffered in memory and handed to the storage layer (local disk or
// S3) by the route. 20 MB ceiling covers document PDFs / Word files.
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};
const DOCUMENT_TYPES = {
  ...IMAGE_TYPES,
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
};

function makeUploader(allowed, maxBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      if (!allowed[file.mimetype]) return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
      cb(null, true);
    },
  });
}

const upload = makeUploader(IMAGE_TYPES, 8 * 1024 * 1024);
const documentUpload = makeUploader(DOCUMENT_TYPES, 20 * 1024 * 1024);

// Extension for a multer file, from its mime type (falling back to the name).
function extFor(file) {
  return DOCUMENT_TYPES[file.mimetype] || path.extname(file.originalname || "") || "";
}

module.exports = {
  upload,
  documentUpload,
  extFor,
  // storage passthroughs used by routes
  putPublic: storage.putPublic,
  putPrivate: storage.putPrivate,
  getPrivateStream: storage.getPrivateStream,
  privateExists: storage.privateExists,
  deletePrivate: storage.deletePrivate,
  deleteUploadByUrl: storage.deletePublicByUrl,
};
