/**
 * AvatarDropdown — GitHub-style avatar dropdown menu.
 *
 * Triggered by clicking the avatar in the header. Shows user info,
 * navigation links (Settings, My Projects, Upload), and Sign out.
 * Admin users see an additional Admin section with flat links.
 *
 * Keyboard: Enter/Space to toggle, Arrow keys to navigate, Escape to close.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserRole } from "@wellorbetter/shared";
import "./AvatarDropdown.css";

export interface AvatarDropdownUser {
  /** Display name (falls back to username when absent). */
  name: string;
  /** Username / handle (secondary text). */
  username: string;
  role: UserRole;
}

export interface AvatarDropdownProps {
  user: AvatarDropdownUser;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}

/* ------------------------------------------------------------------ */
/* Inline SVG icon paths (feather-style, 18×18 within 24×24 viewBox). */
/* ------------------------------------------------------------------ */

const ICON_SETTINGS =
  '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.6" fill="none"/>';

const ICON_FOLDER =
  '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.6" fill="none"/>';

const ICON_UPLOAD =
  '<path d="M12 16V4m0 0L7 9m5-5l5 5M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';

const ICON_USERS =
  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>';

const ICON_LOGOUT =
  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';

const ICON_SHIELD =
  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';

function svgIcon(paths: string, size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths}</svg>`;
}

function initial(value: string): string {
  return Array.from(value.trim())[0]?.toUpperCase() ?? "?";
}

/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  path: string;
  iconHtml: string;
}

export function AvatarDropdown({ user, onNavigate, onSignOut }: AvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Build navigation items. */
  const navItems: NavItem[] = [
    { label: "设置", path: "/settings", iconHtml: svgIcon(ICON_SETTINGS) },
    { label: "我的作品", path: "/my-projects", iconHtml: svgIcon(ICON_FOLDER) },
    { label: "发布作品", path: "/publish", iconHtml: svgIcon(ICON_UPLOAD) },
  ];

  const adminItems: NavItem[] =
    user.role === "admin"
      ? [
          { label: "用户管理", path: "/admin/users", iconHtml: svgIcon(ICON_USERS) },
          { label: "作品与举报", path: "/admin/projects", iconHtml: svgIcon(ICON_SHIELD) },
          { label: "用量与配额", path: "/admin/usage", iconHtml: svgIcon(ICON_USERS) },
        ]
      : [];

  /* All focusable items: nav + admin + sign-out. */
  const allItems: NavItem[] = [...navItems, ...adminItems];
  const totalItems = allItems.length + 1; // +1 for sign-out button

  const close = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      close();
      onNavigate(path);
    },
    [close, onNavigate],
  );

  const handleSignOut = useCallback(() => {
    close();
    onSignOut();
  }, [close, onSignOut]);

  /* Click outside to close. */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, close]);

  /* Focus the active menu item when focusIndex changes. */
  useEffect(() => {
    if (!open || focusIndex < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[focusIndex]?.focus();
  }, [focusIndex, open]);

  /* Keyboard navigation within the dropdown. */
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((i) => (i + 1) % totalItems);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((i) => (i - 1 + totalItems) % totalItems);
          break;
        case "Home":
          e.preventDefault();
          setFocusIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusIndex(totalItems - 1);
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "Tab":
          close();
          break;
      }
    },
    [totalItems, close],
  );

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex(0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex(totalItems - 1);
      }
    },
    [open, totalItems],
  );

  const displayName = user.name || user.username;

  return (
    <div className="avatar-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className="avatar-dropdown-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="用户菜单"
        onClick={() => {
          setOpen((v) => !v);
          setFocusIndex(-1);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="avatar-dropdown-avatar" aria-hidden="true">
          {initial(displayName)}
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="avatar-dropdown-menu"
          role="menu"
          aria-label="用户菜单"
          onKeyDown={handleMenuKeyDown}
        >
          {/* User info header (decorative). */}
          <div className="avatar-dropdown-user" role="none">
            <span className="avatar-dropdown-user-avatar" aria-hidden="true">
              {initial(displayName)}
            </span>
            <div className="avatar-dropdown-user-info">
              <div className="avatar-dropdown-user-name">{displayName}</div>
              <div className="avatar-dropdown-user-username">@{user.username}</div>
            </div>
          </div>

          <div className="avatar-dropdown-divider" role="separator" />

          {/* Navigation items. */}
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="avatar-dropdown-item"
              onClick={() => handleSelect(item.path)}
            >
              <span
                className="avatar-dropdown-item-icon"
                dangerouslySetInnerHTML={{ __html: item.iconHtml }}
              />
              <span>{item.label}</span>
            </button>
          ))}

          {/* Admin section (conditional). */}
          {adminItems.length > 0 && (
            <>
              <div className="avatar-dropdown-divider" role="separator" />
              <div className="avatar-dropdown-section-label" role="none">
                管理
              </div>
              {adminItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="avatar-dropdown-item"
                  onClick={() => handleSelect(item.path)}
                >
                  <span
                    className="avatar-dropdown-item-icon"
                    dangerouslySetInnerHTML={{ __html: item.iconHtml }}
                  />
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}

          <div className="avatar-dropdown-divider" role="separator" />

          {/* Sign out (destructive). */}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="avatar-dropdown-item avatar-dropdown-item--destructive"
            onClick={handleSignOut}
          >
            <span
              className="avatar-dropdown-item-icon"
              dangerouslySetInnerHTML={{ __html: svgIcon(ICON_LOGOUT) }}
            />
            <span>登出</span>
          </button>
        </div>
      )}
    </div>
  );
}
