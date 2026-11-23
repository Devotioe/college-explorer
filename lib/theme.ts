export type Theme = "light" | "dark";

type ThemeStorage = Pick<Storage, "getItem">;

export function initialTheme(): Theme {
  return "light";
}

export function readStoredTheme(storage: ThemeStorage): Theme {
  return storage.getItem("course-compass-theme") === "dark" ? "dark" : "light";
}
