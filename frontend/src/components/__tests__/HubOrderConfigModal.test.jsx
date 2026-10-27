import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import HubOrderConfigModal from "../HubOrderConfigModal";
import ModalPortal from "../ModalPortal";

afterEach(cleanup);
const files = [{ id: "order-file", fileName: "report.pdf", pageCount: 4, copies: 1, printOptions: { sides: "one_sided", quality: { dpi: 600 }, scale: { mode: "fit_to_page" }, margins: { mode: "none" } } }];
const props = { isOpen: true, order: { id: "order-1", orderCode: "ORDER-1", totalAmountPaise: 800 }, files, pricing: { bwSingle: 2, bwDouble: 3, colorSingle: 5, colorDouble: 6 }, onClose: vi.fn() };
it("portals outside transformed dashboard containers and saves edited canonical configuration", async () => {
  const onSave = vi.fn().mockResolvedValue({});
  const { container } = render(<div style={{ transform: "translateX(-50%)" }}><HubOrderConfigModal {...props} onSave={onSave} /></div>);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  fireEvent.change(screen.getByLabelText("Copies for report.pdf"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Sides for report.pdf"), { target: { value: "double" } });
  fireEvent.change(screen.getByLabelText(/Note \/ Reason/), { target: { value: "Customer asked for two copies." } });
  fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].files[0]).toMatchObject({ id: "order-file", copies: 2, printOptions: { sides: "two_sided_long_edge", quality: { dpi: 600 }, scale: { mode: "fit_to_page" }, margins: { mode: "none" } } });
});
it("shows errors without closing or discarding the draft", async () => {
  const onClose = vi.fn();
  render(<HubOrderConfigModal {...props} onClose={onClose} onSave={vi.fn().mockRejectedValue(new Error("Order already printed"))} />);
  fireEvent.change(screen.getByLabelText(/Note \/ Reason/), { target: { value: "Correction requested." } });
  fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("Order already printed");
  expect(screen.getByLabelText(/Note \/ Reason/).value).toBe("Correction requested.");
  expect(onClose).not.toHaveBeenCalled();
});
it("explains a missing reason instead of leaving the Save button inert", async () => {
  const onSave = vi.fn();
  render(<HubOrderConfigModal {...props} onSave={onSave} />);
  fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));
  expect((await screen.findByRole("alert")).textContent).toContain("reason");
  expect(onSave).not.toHaveBeenCalled();
});
it("keeps body scrolling locked until the last nested dialog closes", () => {
  const original = document.body.style.overflow;
  const { rerender } = render(<><ModalPortal label="Documents">documents</ModalPortal><ModalPortal label="Preview">preview</ModalPortal></>);
  expect(document.body.style.overflow).toBe("hidden");
  rerender(<ModalPortal label="Documents">documents</ModalPortal>);
  expect(document.body.style.overflow).toBe("hidden");
  cleanup();
  expect(document.body.style.overflow).toBe(original);
});

