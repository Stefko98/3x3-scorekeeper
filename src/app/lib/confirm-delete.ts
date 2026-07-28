export function confirmDelete() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.confirm("Da li ste sigurni da zelite da obrisete?");
}
