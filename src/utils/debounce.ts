export function debounce(cb: () => void, delay: number) {
  let timeoutId;
  if (timeoutId) clearTimeout(timeoutId);
  setTimeout(cb, delay);
}
