import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, test, expect, afterEach } from "vitest";
import PaymentPage from "../PaymentPage";
afterEach(cleanup);

test("shows manual payment request and calls handlePayment", async () => {
  const handlePayment = vi.fn();
  const setPaymentMethod = vi.fn();

  const props = {
    selectedCentre: { name: "Test Centre", upiId: "test@upi", upiQrImageUrl: "https://example.com/qr.png" },
    currentUser: { id: "user-1", role: "user", name: "Test User" },
    documentName: "MyDoc.pdf",
    pages: 2,
    copies: 1,
    backendPrice: null,
    order: { backendId: 123, amount: 50 },
    paymentMethod: "manual",
    setPaymentMethod,
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

  fireEvent.click(screen.getByRole("button", { name: /pay online/i }));
  expect(setPaymentMethod).toHaveBeenCalledWith("razorpay");

  fireEvent.click(screen.getByRole("button", { name: /upi qr/i }));
  expect(setPaymentMethod).toHaveBeenCalledWith("upi_qr");
});

test("shows Razorpay payment button when online method is selected", async () => {
  const handlePayment = vi.fn();

  render(
    <PaymentPage
      selectedCentre={{ name: "Test Centre", upiId: "test@upi" }}
      currentUser={{ id: "user-1", role: "user", name: "Test User" }}
      documentName="MyDoc.pdf"
      pages={2}
      copies={1}
      backendPrice={null}
      order={{ backendId: 123, amount: 50 }}
      paymentMethod="razorpay"
      setPaymentMethod={vi.fn()}
      handlePayment={handlePayment}
      paymentLoading={false}
      paymentError=""
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /^pay ₹50\.00$/i }));
  expect(handlePayment).toHaveBeenCalled();
  expect(screen.queryByText(/request stays pending/i)).toBeNull();
  expect(screen.queryByText(/has not added a UPI/i)).toBeNull();
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
