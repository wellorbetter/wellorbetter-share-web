/**
 * Tests for SettingsPage (T006).
 *
 * Covers:
 * - Page renders "设置" heading
 * - Shows user info (display name, username)
 * - Display name field is read-only
 * - Username field is read-only
 * - Info message "个人资料修改功能暂未开放" is displayed
 * - Loading state
 * - Error state when api.me() fails
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "../pages/Settings.js";
import { api, ApiError } from "../api.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockMeSuccess(username: string, role: "user" | "admin" = "user") {
  vi.spyOn(api, "me").mockResolvedValue({
    ok: true,
    user: { id: "u1", username, role },
  });
}

function mockMeFailure(message = "未登录", code = "unauthorized", status = 401) {
  vi.spyOn(api, "me").mockRejectedValue(new ApiError(code, message, status));
}

describe("SettingsPage", () => {
  it("shows loading state initially", () => {
    // api.me() never resolves → stays in loading
    vi.spyOn(api, "me").mockImplementation(() => new Promise(() => {}));
    render(<SettingsPage onNavigate={vi.fn()} />);
    expect(screen.getByText("加载中…")).toBeTruthy();
  });

  it("renders '设置' heading after data loads", async () => {
    mockMeSuccess("alice");
    render(<SettingsPage onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("设置")).toBeTruthy());
  });

  it("displays user info (display name and username)", async () => {
    mockMeSuccess("alice");
    render(<SettingsPage onNavigate={vi.fn()} />);

    await waitFor(() => {
      // Label "显示名称" should be present
      expect(screen.getByText("显示名称")).toBeTruthy();
      // Label "用户名" should be present
      expect(screen.getByText("用户名")).toBeTruthy();
    });

    // Both input fields should contain the username value
    const displayNameInput = screen.getByLabelText("显示名称") as HTMLInputElement;
    const usernameInput = screen.getByLabelText("用户名") as HTMLInputElement;
    expect(displayNameInput.value).toBe("alice");
    expect(usernameInput.value).toBe("alice");
  });

  it("display name field is read-only", async () => {
    mockMeSuccess("alice");
    render(<SettingsPage onNavigate={vi.fn()} />);

    await waitFor(() => {
      const input = screen.getByLabelText("显示名称") as HTMLInputElement;
      expect(input.readOnly).toBe(true);
      expect(input.getAttribute("aria-readonly")).toBe("true");
      expect(input.tabIndex).toBe(-1);
    });
  });

  it("username field is read-only", async () => {
    mockMeSuccess("alice");
    render(<SettingsPage onNavigate={vi.fn()} />);

    await waitFor(() => {
      const input = screen.getByLabelText("用户名") as HTMLInputElement;
      expect(input.readOnly).toBe(true);
      expect(input.getAttribute("aria-readonly")).toBe("true");
      expect(input.tabIndex).toBe(-1);
    });
  });

  it("displays info message '个人资料修改功能暂未开放'", async () => {
    mockMeSuccess("alice");
    render(<SettingsPage onNavigate={vi.fn()} />);

    await waitFor(() => {
      const msg = screen.getByText("个人资料修改功能暂未开放");
      expect(msg).toBeTruthy();
      expect(msg.getAttribute("role")).toBe("status");
    });
  });

  it("does not render a Save / submit button", async () => {
    mockMeSuccess("alice");
    render(<SettingsPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("设置")).toBeTruthy());

    // No submit / save button should exist (read-only page)
    expect(screen.queryByRole("button", { name: /保存|提交|Save/i })).toBeNull();
  });

  it("shows error state when api.me() fails", async () => {
    mockMeFailure("网络错误");
    render(<SettingsPage onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("网络错误")).toBeTruthy();
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  it("calls api.me() on mount", () => {
    const meSpy = vi.spyOn(api, "me").mockResolvedValue({
      ok: true,
      user: { id: "u1", username: "bob", role: "user" },
    });
    render(<SettingsPage onNavigate={vi.fn()} />);
    expect(meSpy).toHaveBeenCalledTimes(1);
  });
});
