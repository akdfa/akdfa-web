const { Router } = require("express");
const { requireAuth } = require("../../middleware/auth");
const { upload, extFor, putPublic } = require("../../middleware/upload");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

const router = Router();

// POST /uploads — multipart `file` (image or PDF, up to 8 MB) -> { url, filename, mimeType, size }
router.post(
  "/",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded (expected multipart field `file`)");
    const { url } = await putPublic(req.file.buffer, { ext: extFor(req.file), mimeType: req.file.mimetype });
    res.status(201).json({ url, filename: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
  })
);

module.exports = router;
