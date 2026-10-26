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
