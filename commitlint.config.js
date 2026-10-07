// Release tooling reads these messages to bump the version and write the
// changelog, so the header format is enforced; body and footer line length is
// not (trailers and pasted output would trip it).
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
