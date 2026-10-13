const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildExistingCustomerQuery = ({ name, phone, dob }) => {
  if (!name || !phone) return null;

  const query = {
    name: { $regex: new RegExp(`^${escapeRegex(String(name).trim())}$`, "i") },
    phone: String(phone).trim(),
  };

  const parsedDob = dob && dob !== "Invalid Date" ? new Date(dob) : null;
  if (parsedDob && !Number.isNaN(parsedDob.getTime())) {
    query.dob = parsedDob;
  } else {
    query.$or = [{ dob: { $exists: false } }, { dob: null }];
  }
  return query;
};

const findExistingCustomer = async ({ Customer, filters }) => {
  const query = buildExistingCustomerQuery(filters);
  if (!query) return { exists: false };

  const customer = await Customer.findOne(query).select("_id name code phone dob").lean();
  if (!customer) return { exists: false };
  return {
    exists: true,
    customer: {
      _id: customer._id,
      name: customer.name,
      code: customer.code,
      phone: customer.phone,
    },
  };
};

module.exports = { escapeRegex, buildExistingCustomerQuery, findExistingCustomer };
