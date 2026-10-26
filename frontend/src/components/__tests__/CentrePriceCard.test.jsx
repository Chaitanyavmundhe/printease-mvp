import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CentrePriceCard from "../CentrePriceCard";

afterEach(cleanup);

it.each([null, undefined, "", 0, -1, "invalid", true])("does not invent a displayed price for %s", value => {
  render(<CentrePriceCard centre={{ name: "Centre", code: "1234", bwSingle: value, bwDouble: value, colorSingle: value, colorDouble: value }} />);
  expect(screen.getAllByText("Pending")).toHaveLength(4);
});

it("shows valid numeric rates and retains the upload action", () => {
  const upload = vi.fn();
  render(<CentrePriceCard centre={{ name: "Centre", bwSingle: "2.5", bwDouble: 3, colorSingle: 5, colorDouble: 6 }} onUpload={upload} />);
  expect(screen.getByText("₹2.5/page")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Upload to this Centre" }));
  expect(upload).toHaveBeenCalledOnce();
});

it("keeps every compact-card detail and both actions while sharing the price unit", () => {
  const centre = { name: "University Print and Document Centre", code: "2045", bwSingle: 2, bwDouble: 3, colorSingle: 6, colorDouble: 7.5, locationEnabled: true, latitude: 18.5, longitude: 73.8, distanceLabel: "500 m away", printerOnline: true, usageCount: 3 };
  const onUpload = vi.fn();
  const onOpenMap = vi.fn();
  render(<CentrePriceCard centre={centre} compact onUpload={onUpload} onOpenMap={onOpenMap} />);
  for (const text of [centre.name, "Code: 2045", "A4 rates / page", "B/W single", "B/W double", "Color single", "Color double", "₹2", "₹3", "₹6", "₹7.5", "500 m away", "Available", "Used 3 times from this account"]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("button", { name: "View on map" }));
  expect(onOpenMap).toHaveBeenCalledWith(centre);
  fireEvent.click(screen.getByRole("button", { name: "Upload", exact: true }));
  expect(onUpload).toHaveBeenCalledOnce();
});

it("retains Pending rates, offline status and a disabled map without location", () => {
  render(<CentrePriceCard centre={{ name: "Offline centre", code: "1234", bwSingle: 0 }} compact />);
  expect(screen.getAllByText("Pending")).toHaveLength(4);
  expect(screen.getByText("Unavailable")).toBeTruthy();
  expect(screen.getByRole("button", { name: "View on map" }).disabled).toBe(true);
});
