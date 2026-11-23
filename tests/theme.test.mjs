import assert from "node:assert/strict";
import test from "node:test";

import { initialTheme, readStoredTheme } from "../lib/theme.ts";

test("initial render stays light even when the saved theme is dark", () => {
  const storage = { getItem: () => "dark" };

  assert.equal(initialTheme(), "light");
  assert.equal(readStoredTheme(storage), "dark");
});
