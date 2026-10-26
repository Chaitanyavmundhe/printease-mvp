import { useEffect, useState } from "react";
import { normalizeCentreSort } from "../utils/centreSort";

const KEY = "printease_centre_sort";

// Only a UI preference. Location stays in memory and is never saved here.
export function useCentreSort(userLocation) {
  const [value, setValue] = useState(() => {
    try { return normalizeCentreSort(localStorage.getItem(KEY)); }
    catch { return "smart"; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, value); }
    catch { /* Sorting still works when browser storage is unavailable. */ }
  }, [value]);
  return [value === "nearest" && !userLocation ? "smart" : value, next => setValue(normalizeCentreSort(next))];
}
