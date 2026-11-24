/** @param {string} value */
export function normalizeNccuCourseCode(value) {
  const text = value.normalize("NFKC").trim();
  return /^[a-z\d]{6}-?\d{3}$/iu.test(text) ? text.replace("-", "").toUpperCase() : "";
}
