/**
 * Tests for AvatarDropdown component (T002).
 *
 * Covers:
 * - Avatar button rendering with user initial
 * - Dropdown open/close behavior
 * - Keyboard navigation (Escape, ArrowDown)
 * - User info display (name, username)
 * - Menu items (Settings, My Projects, Upload, Sign out)
 * - Admin links conditional rendering
 * - Navigation and sign-out callbacks
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AvatarDropdown } from "../components/AvatarDropdown.js";
import type { AvatarDropdownUser } from "../components/AvatarDropdown.js";

afterEach(() => {
  cleanup();
});

function user(overrides: Partial<AvatarDropdownUser> = {}): AvatarDropdownUser {
  return {
    name: "Alice",
    username: "alice",
    role: "user",
    ...overrides,
  };
}

describe("AvatarDropdown", () => {
  it("renders avatar button with user initial", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    expect(trigger).toBeTruthy();
    // Avatar should show the first letter of the name
    const avatar = trigger.querySelector(".avatar-dropdown-avatar");
    expect(avatar).not.toBeNull();
    expect(avatar!.textContent).toBe("A");
  });

  it("renders user initial from username when name is empty", () => {
    render(<AvatarDropdown user={user({ name: "", username: "bob" })} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const avatar = screen.getByRole("button", { name: "用户菜单" }).querySelector(".avatar-dropdown-avatar");
    expect(avatar!.textContent).toBe("B");
  });

  it("dropdown opens on click", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("dropdown closes on second click", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("dropdown closes on Escape", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows user info (name, username)", () => {
    render(<AvatarDropdown user={user({ name: "Alice", username: "alice123" })} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("@alice123")).toBeTruthy();
  });

  it("shows menu items (Settings, My Projects, Upload, Sign out)", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    expect(screen.getByText("设置")).toBeTruthy();
    expect(screen.getByText("我的作品")).toBeTruthy();
    expect(screen.getByText("发布作品")).toBeTruthy();
    expect(screen.getByText("登出")).toBeTruthy();
  });

  it("shows Admin links only when role === 'admin'", () => {
    const { rerender } = render(
      <AvatarDropdown user={user({ role: "user" })} onNavigate={vi.fn()} onSignOut={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    expect(screen.queryByText("用户管理")).toBeNull();
    expect(screen.queryByText("作品与举报")).toBeNull();
    expect(screen.queryByText("用量与配额")).toBeNull();

    // Close and reopen with admin role
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));
    rerender(<AvatarDropdown user={user({ role: "admin" })} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    expect(screen.getByText("用户管理")).toBeTruthy();
    expect(screen.getByText("作品与举报")).toBeTruthy();
    expect(screen.getByText("用量与配额")).toBeTruthy();
  });

  it("calls onNavigate with correct path when menu item clicked", () => {
    const onNavigate = vi.fn();
    render(<AvatarDropdown user={user()} onNavigate={onNavigate} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    fireEvent.click(screen.getByText("设置"));
    expect(onNavigate).toHaveBeenCalledWith("/settings");

    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));
    fireEvent.click(screen.getByText("我的作品"));
    expect(onNavigate).toHaveBeenCalledWith("/my-projects");

    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));
    fireEvent.click(screen.getByText("发布作品"));
    expect(onNavigate).toHaveBeenCalledWith("/publish");
  });

  it("calls onNavigate with admin paths when admin menu item clicked", () => {
    const onNavigate = vi.fn();
    render(<AvatarDropdown user={user({ role: "admin" })} onNavigate={onNavigate} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    fireEvent.click(screen.getByText("用户管理"));
    expect(onNavigate).toHaveBeenCalledWith("/admin/users");

    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));
    fireEvent.click(screen.getByText("作品与举报"));
    expect(onNavigate).toHaveBeenCalledWith("/admin/projects");

    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));
    fireEvent.click(screen.getByText("用量与配额"));
    expect(onNavigate).toHaveBeenCalledWith("/admin/usage");
  });

  it("calls onSignOut when Sign out clicked", () => {
    const onSignOut = vi.fn();
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));

    fireEvent.click(screen.getByText("登出"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("keyboard navigation: ArrowDown moves focus to first item", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });

    // First menu item should be focused
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems[0]).toBeTruthy();
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it("keyboard navigation: ArrowDown cycles through items", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);

    const menu = screen.getByRole("menu");
    const menuItems = screen.getAllByRole("menuitem");

    // Navigate down through all items
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[0]);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[1]);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[2]);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[3]); // Sign out

    // Cycle back to first
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it("keyboard navigation: ArrowUp moves focus to last item", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);

    const menu = screen.getByRole("menu");
    // First move focus into the menu
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    // Then press ArrowUp to go to last item
    fireEvent.keyDown(menu, { key: "ArrowUp" });

    const menuItems = screen.getAllByRole("menuitem");
    const lastItem = menuItems[menuItems.length - 1];
    expect(document.activeElement).toBe(lastItem);
  });

  it("dropdown closes when clicking outside", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    // Click outside the dropdown
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("dropdown closes after selecting a menu item", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.click(screen.getByText("设置"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("dropdown closes after signing out", () => {
    render(<AvatarDropdown user={user()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "用户菜单" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.click(screen.getByText("登出"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
