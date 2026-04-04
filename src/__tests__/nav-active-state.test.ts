import { describe, it, expect } from "vitest";

// Test the active state logic from sidebar.tsx and mobile-nav.tsx
function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

describe("nav active state", () => {
  it("home is active only on exact /", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/decks", "/")).toBe(false);
    expect(isActive("/settings", "/")).toBe(false);
  });

  it("/decks is active on /decks", () => {
    expect(isActive("/decks", "/decks")).toBe(true);
  });

  it("/decks is active on /decks/123", () => {
    expect(isActive("/decks/123", "/decks")).toBe(true);
  });

  it("/decks is active on /decks/123/edit", () => {
    expect(isActive("/decks/123/edit", "/decks")).toBe(true);
  });

  it("/decks/new is active on /decks/new", () => {
    expect(isActive("/decks/new", "/decks/new")).toBe(true);
  });

  it("/decks/new is NOT active on /decks", () => {
    expect(isActive("/decks", "/decks/new")).toBe(false);
  });

  it("/decks/new is NOT active on /decks/123", () => {
    expect(isActive("/decks/123", "/decks/new")).toBe(false);
  });

  it("/analytics is active on /analytics", () => {
    expect(isActive("/analytics", "/analytics")).toBe(true);
  });

  it("/analytics is NOT active on /decks", () => {
    expect(isActive("/decks", "/analytics")).toBe(false);
  });

  it("/settings is active on /settings", () => {
    expect(isActive("/settings", "/settings")).toBe(true);
  });

  it("/settings is active on /settings/profile", () => {
    expect(isActive("/settings/profile", "/settings")).toBe(true);
  });

  it("/settings is NOT active on /decks", () => {
    expect(isActive("/decks", "/settings")).toBe(false);
  });
});
