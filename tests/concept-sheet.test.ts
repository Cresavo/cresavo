import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { IconButton } from "@/concept/ui/button";
import { Sheet } from "@/concept/ui/sheet";

const { useEffect, useRef, useState } = vi.hoisted(() => ({
  useEffect: vi.fn<(effect: () => void) => void>(),
  useRef: vi.fn(),
  useState: vi.fn(),
}));

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect,
  useId: () => "sheet-title",
  useRef,
  useState,
}));

function closeButton(node: ReactNode): { onClick: () => void } | undefined {
  if (!isValidElement<{ children?: ReactNode; onClick: () => void }>(node)) return;
  if (node.type === IconButton) return node.props;
  return Children.toArray(node.props.children).map(closeButton).find(Boolean);
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it.each(["Escape", "close button", "backdrop"])("restores focus before notifying the caller after %s", async method => {
  const ownerDocument = { activeElement: {} };
  class Trigger {
    isConnected = true;
    focus = vi.fn(() => { ownerDocument.activeElement = this; });
  }
  vi.stubGlobal("HTMLElement", Trigger);
  const trigger = new Trigger();
  ownerDocument.activeElement = trigger;

  let finishExit!: () => void;
  const finished = new Promise<void>(resolve => { finishExit = resolve; });
  const dialog = {
    ownerDocument,
    open: false,
    showModal() { this.open = true; ownerDocument.activeElement = this; },
    close: vi.fn(() => { dialog.open = false; ownerDocument.activeElement = {}; }),
    getAnimations: () => [{ finished }],
    hasAttribute: () => false,
  };
  const opener = { current: null };
  const onClose = vi.fn(() => {
    expect(dialog.open).toBe(false);
    expect(ownerDocument.activeElement).toBe(trigger);
  });
  const requestDismissal = vi.fn();
  const render = (dismissing: boolean) => {
    useRef.mockReturnValueOnce({ current: dialog }).mockReturnValueOnce(opener);
    useState.mockReturnValueOnce([true, vi.fn()]).mockReturnValueOnce([dismissing, requestDismissal]);
    return Sheet({ open: true, title: "Caller", children: null, onClose }) as ReactElement<ComponentProps<"dialog">>;
  };
  const sheet = render(false);
  useEffect.mock.lastCall![0]();
  expect(dialog.open).toBe(true);

  switch (method) {
    case "Escape": {
      const preventDefault = vi.fn();
      sheet.props.onCancel!({ preventDefault } as unknown as Parameters<NonNullable<typeof sheet.props.onCancel>>[0]);
      expect(preventDefault).toHaveBeenCalledOnce();
      break;
    }
    case "close button":
      closeButton(sheet)!.onClick();
      break;
    case "backdrop":
      sheet.props.onClick!({ target: dialog, currentTarget: dialog } as unknown as Parameters<NonNullable<typeof sheet.props.onClick>>[0]);
      break;
  }
  expect(requestDismissal).toHaveBeenCalledExactlyOnceWith(true);
  expect(onClose).not.toHaveBeenCalled();

  const closing = render(true);
  useEffect.mock.lastCall![0]();
  expect(dialog.close).not.toHaveBeenCalled();
  finishExit();
  await vi.waitFor(() => expect(trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true }));

  closing.props.onClose!({ currentTarget: dialog } as unknown as Parameters<NonNullable<typeof closing.props.onClose>>[0]);
  expect(onClose).toHaveBeenCalledOnce();
});

it.each([[true, "show"], [false, "showModal"]] as const)("a docked sheet opens beside the page on a wide screen (wide: %s)", (wide, opened) => {
  const attributes = new Set<string>();
  const keydown: EventListener[] = [];
  const requestDismissal = vi.fn();
  const dialog = {
    ownerDocument: {
      activeElement: {},
      defaultView: { matchMedia: (query: string) => ({ matches: wide && query === "(min-width: 1280px)" }) },
      addEventListener: (type: string, listener: EventListener) => { if (type === "keydown") keydown.push(listener); },
      removeEventListener: (type: string, listener: EventListener) => { if (type === "keydown") keydown.splice(keydown.indexOf(listener), 1); },
      querySelectorAll: (selector: string) => selector === "dialog[open]" ? [] : [],
    },
    open: false,
    show: vi.fn(() => { dialog.open = true; }),
    showModal: vi.fn(() => { dialog.open = true; }),
    toggleAttribute: (name: string, on: boolean) => { if (on) attributes.add(name); else attributes.delete(name); },
    hasAttribute: (name: string) => attributes.has(name),
  };
  useRef.mockReturnValueOnce({ current: dialog }).mockReturnValueOnce({ current: null });
  useState.mockReturnValueOnce([true, vi.fn()]).mockReturnValueOnce([false, requestDismissal]);
  const sheet = Sheet({ open: true, dock: true, title: "Booking", children: null, onClose: vi.fn() }) as ReactElement<ComponentProps<"dialog">>;
  useEffect.mock.lastCall![0]();
  expect(dialog[opened]).toHaveBeenCalledOnce();
  expect(attributes.has("data-docked")).toBe(wide);

  // Escape: the browser gives a docked panel none, so the sheet listens on the dialog and on the document.
  const preventDefault = vi.fn();
  const currentTarget = { hasAttribute: (name: string) => attributes.has(name) };
  sheet.props.onKeyDown!({ key: "Escape", preventDefault, currentTarget } as unknown as Parameters<NonNullable<typeof sheet.props.onKeyDown>>[0]);
  expect(preventDefault).toHaveBeenCalledTimes(wide ? 1 : 0);

  if (wide) {
    const fromPage = vi.fn();
    keydown.at(-1)!({ key: "Escape", defaultPrevented: false, preventDefault: fromPage } as unknown as Event);
    expect(fromPage).toHaveBeenCalledOnce();
    expect(requestDismissal).toHaveBeenCalledWith(true);
  } else {
    expect(keydown).toHaveLength(0);
  }
});
