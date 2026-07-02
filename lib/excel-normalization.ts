const PHARMACIST_NAME_MAPPINGS: ReadonlyArray<
  readonly [canonicalName: string, rawNames: readonly string[]]
> = [
  ["Aya Wahba", ["Aya Wahba", "aya Wahba"]],
  ["Dina Raid", ["Dina Raid", "Dina raid"]],
  ["Kholoud Elkholy", ["Kholoud Elkholy", "kholoud Elkholy"]],
  ["Mohamed Nour", ["Mohamed Nour"]],
  ["Nadine", ["Nadine", "nadine"]],
  ["Samaa Ahmed", ["Samaa Ahmed"]],
];

const PHARMACIST_NAME_MAP = new Map(
  PHARMACIST_NAME_MAPPINGS.flatMap(([canonicalName, rawNames]) =>
    rawNames.map((rawName) => [createComparisonKey(rawName), canonicalName]),
  ),
);

export function removeExtraSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function createComparisonKey(value: string) {
  return removeExtraSpaces(value).toLocaleLowerCase("en-US");
}

export function toTitleCase(value: string) {
  return removeExtraSpaces(value)
    .toLocaleLowerCase("en-US")
    .replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase("en-US"));
}

export function normalizePharmacistName(value: string) {
  const cleanedName = removeExtraSpaces(value);
  const mappedName = PHARMACIST_NAME_MAP.get(createComparisonKey(cleanedName));

  return mappedName ?? toTitleCase(cleanedName);
}

export function normalizeIssueName(value: string) {
  return toTitleCase(value);
}
