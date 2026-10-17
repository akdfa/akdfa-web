// File storage with two drivers:
//   UPLOAD_DRIVER=local  → public files under ./uploads (served by express.static),
//                          private document files under ./private/documents
//   UPLOAD_DRIVER=s3     → an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO…)
//                          public/<name> and documents/<name>
//
// Route code deals only in these functions, never raw paths.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("./env");
const ApiError = require("../utils/ApiError");

const DRIVER = env.uploads.driver;

const publicRoot = path.join(process.cwd(), env.uploads.dir);
const privateRoot = path.join(process.cwd(), "private", "documents");
fs.mkdirSync(publicRoot, { recursive: true });
fs.mkdirSync(privateRoot, { recursive: true });

function randomName(ext) {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext || ""}`;
}

function safeLocal(root, name) {
  const abs = path.resolve(root, name || "");
  if (abs !== path.join(root, path.basename(abs))) throw ApiError.badRequest("Invalid file reference");
  return abs;
}

// ---- S3 (lazy — only require the SDK when actually used) ----------------
let _s3;
function s3() {
  if (!_s3) {
    const { S3Client } = require("@aws-sdk/client-s3");
    _s3 = new S3Client({
      region: env.s3.region,
      ...(env.s3.endpoint ? { endpoint: env.s3.endpoint, forcePathStyle: true } : {}),
      ...(env.s3.accessKeyId
        ? { credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey } }
        : {}),
    });
  }
  return _s3;
}
async function s3Put(key, body, contentType, bucket = env.s3.bucket) {
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
async function s3GetStream(key, bucket = env.s3.privateBucket) {
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return r.Body; // Node Readable
}
async function s3Delete(key, bucket = env.s3.bucket) {
  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
}
function s3PublicUrl(key) {
  if (env.s3.publicBaseUrl) return `${env.s3.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  if (env.s3.endpoint) return `${env.s3.endpoint.replace(/\/$/, "")}/${env.s3.bucket}/${key}`;
  return `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`;
}

// ---- public API -------------------------------------------------------

// Store a publicly-served file (profile photo, news cover, product image…).
async function putPublic(buffer, { ext, mimeType }) {
  const name = randomName(ext);
  if (DRIVER === "s3") {
    const key = `public/${name}`;
    await s3Put(key, buffer, mimeType);
    return { url: s3PublicUrl(key) };
  }
  await fs.promises.writeFile(path.join(publicRoot, name), buffer);
  return { url: `${env.publicBaseUrl.replace(/\/$/, "")}/uploads/${name}` };
}

// Store a private document file. Returns the opaque fileKey persisted on the row.
async function putPrivate(buffer, { ext, mimeType }) {
  const name = randomName(ext);
  if (DRIVER === "s3") {
    await s3Put(`documents/${name}`, buffer, mimeType, env.s3.privateBucket);
  } else {
    await fs.promises.writeFile(path.join(privateRoot, name), buffer);
  }
  return name;
}

// A readable stream for a private document, for the auth-checked download route.
async function getPrivateStream(fileKey) {
  if (DRIVER === "s3") return s3GetStream(`documents/${fileKey}`);
  return fs.createReadStream(safeLocal(privateRoot, fileKey));
}

async function privateExists(fileKey) {
  if (DRIVER === "s3") {
    try {
      const { HeadObjectCommand } = require("@aws-sdk/client-s3");
      await s3().send(new HeadObjectCommand({ Bucket: env.s3.privateBucket, Key: `documents/${fileKey}` }));
      return true;
    } catch (_) {
      return false;
    }
  }
  return fs.existsSync(safeLocal(privateRoot, fileKey));
}

async function deletePrivate(fileKey) {
  if (DRIVER === "s3") return s3Delete(`documents/${fileKey}`, env.s3.privateBucket);
  fs.promises.unlink(safeLocal(privateRoot, fileKey)).catch(() => {});
}

// Best-effort delete of a public file given the URL we stored.
async function deletePublicByUrl(url) {
  if (typeof url !== "string") return;
  if (DRIVER === "s3") {
    const m = url.match(/\/(public\/[A-Za-z0-9._-]+)$/);
    if (m) await s3Delete(m[1]);
    return;
  }
  const m = url.match(/\/uploads\/([A-Za-z0-9._-]+)$/);
  if (!m) return;
  fs.promises.unlink(safeLocal(publicRoot, m[1])).catch(() => {});
}

module.exports = {
  driver: DRIVER,
  publicRoot,
  putPublic,
  putPrivate,
  getPrivateStream,
  privateExists,
  deletePrivate,
  deletePublicByUrl,
};
