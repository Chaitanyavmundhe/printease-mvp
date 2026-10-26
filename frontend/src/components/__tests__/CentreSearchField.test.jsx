import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CentreSearchField from "../CentreSearchField";

afterEach(cleanup);

it("updates on typing and clears without a separate online search action", () => {
  const onChange = vi.fn();
  render(<CentreSearchField value="Alpha" onChange={onChange} label="Find centre" resultsId="results" />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Alpah" } });
  expect(onChange).toHaveBeenLastCalledWith("Alpah");
  fireEvent.click(screen.getByRole("button", { name: "Clear centre search" }));
  expect(onChange).toHaveBeenLastCalledWith("");
});

it("prevents navigation on Enter and dismisses the keyboard", () => {
  render(<CentreSearchField value="Alpha" onChange={vi.fn()} label="Find centre" />);
  screen.getByRole("searchbox").focus();
  expect(fireEvent.submit(screen.getByRole("search"))).toBe(false);
  expect(document.activeElement).not.toBe(screen.getByRole("searchbox"));
});
