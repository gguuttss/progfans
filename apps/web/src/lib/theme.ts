/** Apply a theme client-side: toggle the `.dark` class and persist the cookie. */
export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.cookie = `theme=${dark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
}
