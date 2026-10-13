const {
  IMAGE_UPLOAD_TYPES,
  DOCUMENT_UPLOAD_TYPES,
  validateUploadedFile,
} = require("../middleware/secureUpload");

const runValidation = (file, types) => new Promise((resolve) => {
  const req = { file };
  validateUploadedFile(types)(req, {}, (error) => resolve({ error, req }));
});

describe("secure upload signature validation", () => {
  test("accepts a PNG whose bytes match its declared extension", async () => {
    const buffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    const { error } = await runValidation(
      { originalname: "face.png", mimetype: "image/png", buffer },
      IMAGE_UPLOAD_TYPES
    );
    expect(error).toBeUndefined();
  });

  test("rejects script content renamed as an image and clears its buffer", async () => {
    const buffer = Buffer.from("<script>alert(1)</script>");
    const { error, req } = await runValidation(
      { originalname: "face.png", mimetype: "image/png", buffer },
      IMAGE_UPLOAD_TYPES
    );
    expect(error).toEqual(expect.objectContaining({
      code: "UNSAFE_UPLOAD",
      statusCode: 415,
    }));
    expect(req.file).toBeUndefined();
    expect(buffer.every((value) => value === 0)).toBe(true);
  });

  test("accepts PDF signature only for the document allowlist", async () => {
    const { error } = await runValidation(
      {
        originalname: "notice.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\n"),
      },
      DOCUMENT_UPLOAD_TYPES
    );
    expect(error).toBeUndefined();
  });
});
