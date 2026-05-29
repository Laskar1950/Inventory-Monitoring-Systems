export function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}
