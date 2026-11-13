import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SwipeRow } from "../swipe-row";
import { SWIPE } from "@/lib/swipe-row";

beforeEach(() => {
  vi.useFakeTimers();
  HTMLElement.prototype.setPointerCapture = () => {};
});
afterEach(() => vi.useRealTimers());

function swipeOpen(content: HTMLElement) {
  fireEvent.pointerDown(content, { pointerId: 1, button: 0, clientX: 300, clientY: 10 });
  for (let x = 292; x >= 240; x -= 8) fireEvent.pointerMove(content, { pointerId: 1, clientX: x, clientY: 10 });
  fireEvent.pointerUp(content, { pointerId: 1, clientX: 240, clientY: 10 });
  act(() => void vi.advanceTimersByTime(1000));
}

describe("SwipeRow", () => {
  it("tapping Delete on an open row deletes it once the row has collapsed", () => {
    const onDelete = vi.fn();
    render(
      <SwipeRow onDelete={onDelete}>
        <span>Set 2</span>
      </SwipeRow>,
    );
    const content = screen.getByText("Set 2").parentElement!;
    swipeOpen(content);
    expect(content.style.transform).toContain("translate3d(-");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(SWIPE.deleteSeconds * 1000));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("tapping the open row's content only closes it", () => {
    const onDelete = vi.fn();
    const onTap = vi.fn();
    render(
      <SwipeRow onDelete={onDelete}>
        <button type="button" onClick={onTap}>
          Log
        </button>
      </SwipeRow>,
    );
    const content = screen.getByText("Log").parentElement!;
    swipeOpen(content);
    fireEvent.click(screen.getByText("Log"));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onTap).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
