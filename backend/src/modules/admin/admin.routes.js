const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth, attachAuthIfPresent } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { logAudit } = require("./audit.service");
const { documentUpload, extFor, putPrivate, getPrivateStream, privateExists, deletePrivate } = require("../../middleware/upload");
const { documentListWhere, canReadDocument, canManageDocument } = require("./documents.access");

const router = Router();

// Phase 4 — "store official documents: bylaws, meeting minutes, circulars in one
// safe place, with rules about who can see each one."
//
// Files are stored outside the web root; the fileKey is never returned to the
// client. Downloads go through the visibility-checked streaming routes below.

const DOC_TYPES = ["BYLAW", "MINUTES", "CIRCULAR", "OTHER"];
const DOC_VISIBILITY = ["PUBLIC", "STATE_ONLY", "DISTRICT_ONLY"];

function publicDocument(doc) {
  const { fileKey, ...rest } = doc;
  return { ...rest, hasFile: !!fileKey };
}

router.get(
  "/documents",
  requireAuth,
  asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
      where: documentListWhere(req.auth),
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { fullName: true } }, district: { select: { name: true } } },
    });
    res.json({ documents: documents.map(publicDocument) });
  })
);

// Stream the file itself, after re-checking visibility for this exact request.
router.get(
  "/documents/:id/file",
  attachAuthIfPresent,
  asyncHandler(async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw ApiError.notFound("Document not found");
    if (!canReadDocument(doc, req.auth)) throw ApiError.forbidden("You don't have access to this document");
    if (!(await privateExists(doc.fileKey))) throw ApiError.notFound("File is missing from storage");

    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.originalName || doc.title || "document")}"`
    );
    res.setHeader("Cache-Control", "private, no-store");
    (await getPrivateStream(doc.fileKey)).pipe(res);
  })
);

router.post(
  "/documents",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  documentUpload.single("file"),
  validate({
    body: z.object({
      title: z.string().min(2),
      type: z.enum(DOC_TYPES),
      visibility: z.enum(DOC_VISIBILITY).default("DISTRICT_ONLY"),
      districtId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("A file is required (field name 'file')");

    // District admins can only file into their own district. State admins may
    // target any district, or none (STATE_ONLY / PUBLIC).
    const districtId =
      req.auth.role === "STATE_ADMIN" ? req.body.districtId || null : req.auth.districtId;
    if (req.body.visibility === "DISTRICT_ONLY" && !districtId) {
      throw ApiError.badRequest("A DISTRICT_ONLY document needs a district");
    }

    const fileKey = await putPrivate(req.file.buffer, { ext: extFor(req.file), mimeType: req.file.mimetype });
    const document = await prisma.document.create({
      data: {
        title: req.body.title,
        type: req.body.type,
        visibility: req.body.visibility,
        districtId,
        fileKey,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        uploadedById: req.auth.id,
      },
    });
    await logAudit(req.auth.id, "DOCUMENT_UPLOADED", "Document", document.id, {
      title: document.title,
      type: document.type,
      visibility: document.visibility,
    });
    res.status(201).json({ document: publicDocument(document) });
  })
);

router.patch(
  "/documents/:id",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z
      .object({
        title: z.string().min(2),
        type: z.enum(DOC_TYPES),
        visibility: z.enum(DOC_VISIBILITY),
        districtId: z.string().nullable(),
      })
      .partial(),
  }),
  asyncHandler(async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw ApiError.notFound("Document not found");
    if (!canManageDocument(doc, req.auth)) throw ApiError.forbidden();

    const data = { ...req.body };
    if (req.auth.role !== "STATE_ADMIN") delete data.districtId; // district admins can't move a doc out of their district
    const nextVisibility = data.visibility || doc.visibility;
    const nextDistrict = data.districtId !== undefined ? data.districtId : doc.districtId;
    if (nextVisibility === "DISTRICT_ONLY" && !nextDistrict) {
      throw ApiError.badRequest("A DISTRICT_ONLY document needs a district");
    }

    const updated = await prisma.document.update({ where: { id: doc.id }, data });
    await logAudit(req.auth.id, "DOCUMENT_UPDATED", "Document", doc.id, req.body);
    res.json({ document: publicDocument(updated) });
  })
);

router.delete(
  "/documents/:id",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw ApiError.notFound("Document not found");
    if (!canManageDocument(doc, req.auth)) throw ApiError.forbidden();

    await prisma.document.delete({ where: { id: doc.id } });
    await deletePrivate(doc.fileKey); // best-effort
    await logAudit(req.auth.id, "DOCUMENT_DELETED", "Document", doc.id, { title: doc.title });
    res.status(204).send();
  })
);

// Phase 4 — audit trail read access, State Committee only.
router.get(
  "/audit-logs",
  requireAuth,
  requireRole("STATE_ADMIN"),
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.query;
    const logs = await prisma.auditLog.findMany({
      where: { entityType: entityType || undefined, entityId: entityId || undefined },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { fullName: true, role: true } } },
    });
    res.json({ logs });
  })
);

module.exports = router;
