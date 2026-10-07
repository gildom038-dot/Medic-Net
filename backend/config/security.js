function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /^(replace|your|change|example|placeholder)/i.test(secret)) {
    throw new Error("JWT_SECRET must be a non-placeholder random value of at least 32 characters.");
  }
  return secret;
}

module.exports = { getJwtSecret };
