const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const uploadRoot = path.join(process.cwd(), env.uploads.dir);
fs.mkdirSync(uploadRoot, { recursive: true });

const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const ext = ALLOWED[file.mimetype] || path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// Turns a stored filename into the public URL the frontend should persist.
function publicUrl(filename) {
  return `${env.publicBaseUrl.replace(/\/$/, "")}/uploads/${filename}`;
}

module.exports = { upload, publicUrl, uploadRoot };
