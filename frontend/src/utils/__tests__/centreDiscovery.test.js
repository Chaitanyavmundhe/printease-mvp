import { describe, expect, it } from "vitest";
import { centreMatchesSearch, formatDistanceKm, hasCentreLocation, rankCentres } from "../centreDiscovery";

const centres = [
  { id: "expensive", code: "1001", name: "Alpha", bwSingle: 10, bwDouble: 1, colorSingle: 3, colorDouble: 8, printerOnline: true },
  { id: "cheap", code: "2045", name: "Beta", bwSingle: "2", bwDouble: 4, colorSingle: 6, colorDouble: 2, printerOnline: false, status: "Available" },
  { id: "unknown", code: "3003", name: "Gamma", bwSingle: "", bwDouble: -1, colorSingle: null, printerOnline: true },
];
const ids = (items, options) => rankCentres(items, options).map(item => item.id);

describe("explicit centre sorts", () => {
  it("makes price primary even when the cheapest centre is offline", () => {
    expect(ids(centres, { sortBy: "price_bw" })).toEqual(["cheap", "expensive", "unknown"]);
    expect(ids(centres, { sortBy: "price_bw_double" })).toEqual(["expensive", "cheap", "unknown"]);
    expect(ids(centres, { sortBy: "price_color" })).toEqual(["expensive", "cheap", "unknown"]);
    expect(ids(centres, { sortBy: "price_color_double" })).toEqual(["cheap", "expensive", "unknown"]);
  });
  it("keeps empty, zero, negative and invalid prices last", () => {
    const invalid = [0, "", null, -1, "broken"].map((price, index) => ({ id: `bad${index}`, bwSingle: price }));
    expect(ids([...invalid, ...centres], { sortBy: "price_bw" }).slice(0, 2)).toEqual(["cheap", "expensive"]);
  });
  it("does not let a legacy Available label override an explicit offline flag", () => {
    expect(ids(centres, { sortBy: "available" })).toEqual(["expensive", "unknown", "cheap"]);
  });
  it("sorts by name regardless of availability", () => {
    expect(ids([{ ...centres[1], name: "Aardvark" }, centres[0]], { sortBy: "name" })).toEqual(["cheap", "expensive"]);
  });
  it("uses actual distance and puts missing coordinates last", () => {
    const near = { id: "near", locationEnabled: true, latitude: 18.5, longitude: 73.8 };
    const far = { id: "far", printerOnline: true, locationEnabled: true, latitude: 19, longitude: 74 };
    expect(ids([far, { id: "missing" }, near], { sortBy: "nearest", userLocation: { latitude: 18.5, longitude: 73.8 } })).toEqual(["near", "far", "missing"]);
    expect(hasCentreLocation({ locationEnabled: true, latitude: null, longitude: null })).toBe(false);
    expect(hasCentreLocation({ locationEnabled: true, latitude: 120, longitude: 30 })).toBe(false);
    expect(formatDistanceKm(null)).toBe("");
  });
  it("counts one order once when both centre ID and code are present", () => {
    const ranked = rankCentres(centres, { sortBy: "used", orders: [
      { id: "one", centreId: "cheap", centreCode: "2045", createdAt: "2026-10-26" },
      { id: "two", centreId: "expensive", createdAt: "2026-10-20" },
      { id: "three", centreCode: "1001", createdAt: "2026-10-21" },
    ] });
    expect(ranked[0].id).toBe("expensive");
    expect(ranked.find(item => item.id === "cheap").usageCount).toBe(1);
    expect(ranked[0].usageCount).toBe(2);
  });
  it("handles numeric saved last-use timestamps and does not mutate source data", () => {
    const source = [{ id: "old", lastUsedAt: 1000 }, { id: "new", lastUsedAt: 2000 }];
    expect(ids(source, { sortBy: "recent" })).toEqual(["new", "old"]);
    expect(source[0]).toEqual({ id: "old", lastUsedAt: 1000 });
  });
  it("retains numeric centre codes while removing price-limit tokens", () => {
    expect(centreMatchesSearch(centres[1], "2045")).toBe(true);
    expect(centreMatchesSearch(centres[0], "2045")).toBe(false);
    expect(centreMatchesSearch(centres[1], "bw single under 2")).toBe(true);
    expect(centreMatchesSearch({ bwSingle: 1 }, "color under 2")).toBe(false);
  });
});

describe("live relevant centre search", () => {
  it("tolerates spelling mistakes and prefers exact names in Recommended", () => {
    expect(ids(centres, { query: "Aplha" })).toEqual(["expensive"]);
    expect(ids([{ ...centres[0], name: "Alpha" }, { ...centres[1], name: "Alpah" }], { query: "Alpha" })[0]).toBe("expensive");
    expect(ids(centres, { query: "completelyunrelated" })).toEqual([]);
  });
  it("matches words across name and area without relaxing a price constraint", () => {
    const local = { ...centres[0], area: "University Road" };
    expect(centreMatchesSearch(local, "aplHa universty")).toBe(true);
    expect(centreMatchesSearch(local, "aplHa bw single under 2")).toBe(false);
    expect(centreMatchesSearch(local, "aplHa color under 5")).toBe(true);
  });
  it("never fuzzy-matches codes, numeric tokens or one-letter queries", () => {
    expect(ids(centres, { query: "2046" })).toEqual([]);
    expect(ids(centres, { query: "z" })).toEqual([]);
    expect(ids(centres, { query: "2045" })).toEqual(["cheap"]);
  });
  it("shows live partial matches and all centres again when cleared", () => {
    expect(ids(centres, { query: "bet" })).toEqual(["cheap"]);
    expect(ids(centres, { query: "" })).toHaveLength(3);
  });
  it("keeps explicit availability filters strict even with misspelled names", () => {
    expect(ids(centres, { query: "betta online" })).toEqual([]);
    expect(ids(centres, { query: "betta offline" })).toEqual(["cheap"]);
  });
  it("keeps non-Latin names searchable instead of treating them as empty queries", () => {
    expect(ids([{ id: "local", name: "साई प्रिंट" }, { id: "other", name: "दुसरे दुकान" }], { query: "साई" })).toEqual(["local"]);
  });
});

describe("location-aware Recommended", () => {
  it("puts the nearest centre first, retaining its actual offline status", () => {
    const near = { id: "near", printerOnline: false, locationEnabled: true, latitude: 18.5, longitude: 73.8 };
    const far = { ...centres[0], locationEnabled: true, latitude: 19, longitude: 74 };
    expect(ids([far, { id: "unknown", printerOnline: true }, near], { userLocation: { latitude: 18.5, longitude: 73.8 } })).toEqual(["near", "expensive", "unknown"]);
    expect(rankCentres([near])[0].printerOnline).toBe(false);
  });
  it("respects a user's explicit sort rather than overriding it with location", () => {
    expect(ids(centres, { sortBy: "price_bw", userLocation: { latitude: 18.5, longitude: 73.8 } })[0]).toBe("cheap");
  });
});
