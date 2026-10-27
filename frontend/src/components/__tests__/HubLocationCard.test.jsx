import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import HubLocationCard from "../HubLocationCard";
import { apiRequest } from "../../services/api";
import { getCurrentLocation } from "../../utils/location";

vi.mock("../../services/api", () => ({ apiRequest: vi.fn() }));
vi.mock("../../utils/location", async importOriginal => ({
  ...await importOriginal(), getCurrentLocation: vi.fn(),
}));
vi.mock("../../utils/desktopBridge", () => ({ isDesktop: () => false, openExternalUrl: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("shop location privacy and validation", () => {
  it("only fills coordinates on detection; publishing still needs Save", async () => {
    getCurrentLocation.mockResolvedValue({ latitude: 0, longitude: 0 });
    apiRequest.mockResolvedValue({ success: true, centre: {} });
    render(<HubLocationCard currentCentre={{ id: "shop", locationEnabled: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("0.0000000"));
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledOnce());
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toMatchObject({ latitude: 0, longitude: 0, locationEnabled: true });
  });
  it("does not submit out-of-range coordinates", async () => {
    render(<HubLocationCard currentCentre={{ id: "shop", latitude: 91, longitude: 75, locationEnabled: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await screen.findByText(/Enter a valid latitude/);
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("shows provider failure accurately and re-enables retry", async () => {
    getCurrentLocation.mockRejectedValue({ code: 2 });
    render(<HubLocationCard currentCentre={{ id: "shop" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));
    await screen.findByText(/could not determine its location/);
    expect(screen.getByRole("button", { name: "Use Current Location" }).disabled).toBe(false);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

