const path = require("node:path");
const multer = require("multer");

class UploadSecurityError extends Error {
  constructor(message, code = "UNSAFE_UPLOAD", statusCode = 415) {
    super(message);
    this.name = "UploadSecurityError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const signatures = {
  jpeg: (buffer) => buffer?.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  png: (buffer) => buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (buffer) => buffer?.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer?.subarray(8, 12).toString("ascii") === "WEBP",
  pdf: (buffer) => buffer?.subarray(0, 5).toString("ascii") === "%PDF-",
  doc: (buffer) => buffer?.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  docx: (buffer) => buffer?.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
};

const IMAGE_UPLOAD_TYPES = Object.freeze({
  ".jpg": { mime: "image/jpeg", signature: "jpeg" },
  ".jpeg": { mime: "image/jpeg", signature: "jpeg" },
  ".png": { mime: "image/png", signature: "png" },
  ".webp": { mime: "image/webp", signature: "webp" },
});

const DOCUMENT_UPLOAD_TYPES = Object.freeze({
  ...IMAGE_UPLOAD_TYPES,
  ".pdf": { mime: "application/pdf", signature: "pdf" },
  ".doc": { mime: "application/msword", signature: "doc" },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: "docx",
  },
});

const createMemoryUpload = ({ maxBytes, allowedTypes }) => multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: maxBytes },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const expected = allowedTypes[extension];
    if (!expected || expected.mime !== String(file.mimetype || "").toLowerCase()) {
      return callback(new UploadSecurityError("Loại file tải lên không được hỗ trợ."));
    }
    return callback(null, true);
  },
});

const validateUploadedFile = (allowedTypes) => (req, res, next) => {
  if (!req.file) return next();
  const extension = path.extname(req.file.originalname || "").toLowerCase();
  const expected = allowedTypes[extension];
  const matches = expected && signatures[expected.signature]?.(req.file.buffer);
  if (!matches) {
    req.file.buffer?.fill(0);
    req.file = undefined;
    return next(new UploadSecurityError("Nội dung file không khớp với định dạng khai báo."));
  }
  return next();
};

module.exports = {
  UploadSecurityError,
  IMAGE_UPLOAD_TYPES,
  DOCUMENT_UPLOAD_TYPES,
  createMemoryUpload,
  validateUploadedFile,
};
