import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, test, expect, afterEach } from "vitest";
import TrackPage from "../TrackPage";

afterEach(cleanup);
const order = { id: "ORD123", amount: 80, paymentStatus: "requested", status: "payment_requested",
  centre: "Test Centre", document: "File.pdf", pickupCode: "P123" };

test("shows only manual collection instructions and the centre's QR for a pending request", () => {
  const qrUrl = "https://example.com/qr.png";
  render(<TrackPage order={order} pendingPayment={{ id: "pay_1" }}
    centreUpiId="test@upi" centreUpiQrImageUrl={qrUrl} paymentError="" />);
  expect(screen.getByText(/payment request pending/i)).toBeTruthy();
  expect(screen.getByText(/test@upi/i)).toBeTruthy();
  expect(screen.getByAltText(/centre upi qr/i).getAttribute("src")).toBe(qrUrl);
  expect(screen.queryByRole("button", { name: /pay online|generate upi|simulate/i })).toBeNull();
  expect(screen.queryByText(/Payment completed\./)).toBeNull();
});

test("an unpaid order can return to payment without claiming payment was collected", () => {
  const onRequestPayment = vi.fn();
  render(<TrackPage order={{ ...order, status: "bill_confirmed", paymentStatus: "not_requested" }}
    onRequestPayment={onRequestPayment} />);
  fireEvent.click(screen.getByRole("button", { name: "Request Payment" }));
  expect(onRequestPayment).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Payment completed\./)).toBeNull();
});

test("only collected payment shows completion and cancelled orders cannot request payment", () => {
  const props = { onRequestPayment: vi.fn() };
  const { rerender } = render(<TrackPage {...props} order={{ ...order, status: "queued_for_print", paymentStatus: "collected" }} />);
  expect(screen.getByText(/Payment completed\./)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Request Payment" })).toBeNull();
  rerender(<TrackPage {...props} order={{ ...order, status: "cancelled" }} />);
  expect(screen.getByText("Order Cancelled")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Request Payment" })).toBeNull();
});
