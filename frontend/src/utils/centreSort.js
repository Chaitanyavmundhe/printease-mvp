export const CENTRE_SORT_OPTIONS = [
  { value: "smart", label: "Recommended" },
  { value: "available", label: "Available first" },
  { value: "nearest", label: "Nearest first" },
  { value: "price", label: "Lowest starting price" },
  { value: "price_bw", label: "Lowest B/W single-side price" },
  { value: "price_bw_double", label: "Lowest B/W double-side price" },
  { value: "price_color", label: "Lowest colour single-side price" },
  { value: "price_color_double", label: "Lowest colour double-side price" },
  { value: "used", label: "Most used by you" },
  { value: "recent", label: "Recently used by you" },
  { value: "name", label: "Name: A to Z" },
];

export function normalizeCentreSort(value) {
  return CENTRE_SORT_OPTIONS.some(option => option.value === value) ? value : "smart";
}

export function centreSortLabel(value) {
  return CENTRE_SORT_OPTIONS.find(option => option.value === value)?.label || "Recommended";
}
