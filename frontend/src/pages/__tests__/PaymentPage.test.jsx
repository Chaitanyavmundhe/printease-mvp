import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, test, expect, afterEach } from "vitest";
import PaymentPage from "../PaymentPage";
afterEach(cleanup);

test("shows manual payment request and calls handlePayment", async () => {
  const handlePayment = vi.fn();

  const props = {
    selectedCentre: { name: "Test Centre", upiId: "test@upi", upiQrImageUrl: "https://example.com/qr.png" },
    currentUser: { id: "user-1", role: "user", name: "Test User" },
    documentName: "MyDoc.pdf",
    pages: 2,
    copies: 1,
    backendPrice: null,
    order: { backendId: 123, amount: 50 },
    handlePayment,
    paymentLoading: false,
    paymentError: "",
  };

  render(<PaymentPage {...props} />);

  expect(screen.getAllByText(/test@upi/i).length).toBeGreaterThan(0);
  expect(screen.getByAltText(/centre upi qr/i).getAttribute("src")).toBe(props.selectedCentre.upiQrImageUrl);

  const requestBtn = screen.getByRole("button", { name: /request payment/i });
  fireEvent.click(requestBtn);
  expect(handlePayment).toHaveBeenCalled();

  expect(screen.queryByRole("button", { name: /pay online|generate upi|simulate/i })).toBeNull();
  expect(screen.getByText(/request stays pending|only opens a pending request/i)).toBeTruthy();
});

test("keeps limited loginless manual payment and requires login above the limit", () => {
  const handlePayment = vi.fn();
  const startLogin = vi.fn();
  const props = { selectedCentre: { name: "Centre" }, documentName: "file.pdf", copies: 1,
    order: { amount: 10, status: "bill_confirmed" }, handlePayment, startLogin };
  const { rerender } = render(<PaymentPage {...props} pages={1} />);
  fireEvent.click(screen.getByRole("button", { name: /request payment/i }));
  expect(handlePayment).toHaveBeenCalledTimes(1);
  expect(startLogin).not.toHaveBeenCalled();
  rerender(<PaymentPage {...props} pages={6} />);
  fireEvent.click(screen.getByRole("button", { name: /request payment/i }));
  expect(startLogin).toHaveBeenCalledWith("user");
  expect(handlePayment).toHaveBeenCalledTimes(1);
  rerender(<PaymentPage {...props} currentUser={{ id: "u" }} pages={6} />);
  fireEvent.click(screen.getByRole("button", { name: /request payment/i }));
  expect(handlePayment).toHaveBeenCalledTimes(2);
});

test("keeps a multi-file breakdown and the verified total without internal labels", () => {
  render(<PaymentPage currentUser={{ id: "u" }} selectedCentre={{ name: "Centre" }} pages={3} copies={1}
    order={{ amount: 18, status: "bill_confirmed", priceSnapshot: { breakdown: [
      { fileName: "first.pdf", selectedPageCount: 2, copies: 2, totalAmount: 8, pricePerPage: 2 },
      { fileName: "second.pdf", selectedPageCount: 1, copies: 1, totalAmount: 10, pricePerPage: 10 },
    ] } }} setPaymentMethod={vi.fn()} handlePayment={vi.fn()} />);
  expect(screen.getByText("first.pdf")).toBeTruthy();
  expect(screen.getByText("second.pdf")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Request Payment.*18\.00/ }).disabled).toBe(false);
  expect(screen.queryByText("Shown per file below")).toBeNull();
  expect(screen.queryByText(/Cash Collected/)).toBeNull();
});

test("retains pending-price and cancelled-order guards after presentation cleanup", () => {
  const props = { selectedCentre: { name: "Centre" }, pages: 2, copies: 1, handlePayment: vi.fn(), setPaymentMethod: vi.fn(), refreshActivePaymentOrder: vi.fn(async () => null) };
  const { rerender } = render(<PaymentPage {...props} order={{ amount: 0, status: "awaiting_hub_bill_confirmation" }} />);
  expect(screen.getByRole("button", { name: /Preparing verified bill/ }).disabled).toBe(true);
  expect(screen.queryByText("₹0.00")).toBeNull();
  rerender(<PaymentPage {...props} order={{ amount: 20, status: "cancelled" }} />);
  expect(screen.getByRole("heading", { name: "Order Cancelled" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Request Payment/ })).toBeNull();
  expect(props.handlePayment).not.toHaveBeenCalled();
});

test("never presents a pending file placeholder as an actual file price", () => {
  render(<PaymentPage currentUser={{ id: "u" }} selectedCentre={{ name: "Centre" }} pages={2} copies={1}
    order={{ amount: 20, status: "bill_confirmed", priceSnapshot: { breakdown: [
      { fileName: "pending.docx", pricingPending: true, totalAmount: 1, pricePerPage: 1, copies: 1 },
      { fileName: "ready.pdf", selectedPageCount: 2, totalAmount: 19, copies: 1 },
    ] } }} setPaymentMethod={vi.fn()} handlePayment={vi.fn()} />);
  expect(screen.queryByText("₹1.00")).toBeNull();
  expect(screen.getByText("Pending")).toBeTruthy();
});
