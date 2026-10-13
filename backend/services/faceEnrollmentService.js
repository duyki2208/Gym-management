class FaceEnrollmentError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "FaceEnrollmentError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const resolveCustomer = async ({ Customer, CustomerPackage, id }) => {
  let customer = await Customer.findById(id);
  if (customer) return customer;
  const customerPackage = await CustomerPackage.findById(id).select("customer").lean();
  return customerPackage ? Customer.findById(customerPackage.customer) : null;
};

const enrollCustomerFace = async ({
  Customer,
  CustomerPackage,
  customerId,
  file,
  imageBase64,
  faceClient,
  cloudinary,
}) => {
  if (!file?.buffer) throw new FaceEnrollmentError("Vui lòng gửi ảnh kèm theo", 400, "FACE_IMAGE_REQUIRED");
  const customer = await resolveCustomer({ Customer, CustomerPackage, id: customerId });
  if (!customer) throw new FaceEnrollmentError("Không tìm thấy khách hàng", 404, "CUSTOMER_NOT_FOUND");

  const result = await faceClient.getEmbedding(file.buffer);
  if (!result.found || !Array.isArray(result.embedding) || result.embedding.length === 0) {
    throw new FaceEnrollmentError(
      result.message || "Không phát hiện khuôn mặt trong ảnh. Hãy chụp lại.",
      422,
      "FACE_NOT_FOUND"
    );
  }

  customer.faceEmbedding = result.embedding;
  try {
    if (customer.avatarUrl) {
      const oldPublicId = cloudinary.extractPublicId(customer.avatarUrl);
      if (oldPublicId) {
        try {
          await cloudinary.client.uploader.destroy(oldPublicId);
        } catch {
          // A stale avatar must not prevent replacing it with the new image.
        }
      }
    }
    const uploadResult = await cloudinary.uploadBuffer(file.buffer);
    customer.avatarUrl = uploadResult.secure_url;
    customer.avatar = "";
  } catch (error) {
    // Embedding enrollment remains usable if the optional avatar upload fails.
    if (imageBase64) customer.avatar = imageBase64;
  }
  await customer.save();
  return { embeddingSize: result.embedding.length, avatarUrl: customer.avatarUrl };
};

module.exports = { FaceEnrollmentError, resolveCustomer, enrollCustomerFace };
