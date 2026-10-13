const getReleaseSha = (env = process.env) => {
  const candidates = [
    env.RELEASE_SHA,
    env.RENDER_GIT_COMMIT,
    env.GITHUB_SHA,
  ];

  return candidates
    .map((value) => String(value || "").trim())
    .find(Boolean) || "development";
};

module.exports = { getReleaseSha };
