"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  badge?: string;
  category?: string;
}

const MENU_LIST_STORAGE_KEY = "stupa_sidebar_menu_list_collapsed_v1";

function SidebarNavInner({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  const [isMenuListCollapsed, setIsMenuListCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MENU_LIST_STORAGE_KEY);
      if (saved === "1") {
        setIsMenuListCollapsed(true);
      }
    } catch {
      // Abaikan
    }
  }, []);

  const toggleMenuList = () => {
    const next = !isMenuListCollapsed;
    setIsMenuListCollapsed(next);
    try {
      window.localStorage.setItem(MENU_LIST_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Abaikan
    }
  };

  // Group by category if present
  const categories = Array.from(new Set(nav.map((n) => n.category || "Menu Utama")));

  return (
    <div className="space-y-3">
      {/* Tombol Sembunyikan / Tampilkan Daftar Menu di Dalam Sidebar */}
      <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/70">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <i className="fa-solid fa-compass text-blue-600" />
          <span>Daftar Menu</span>
        </span>
        <button
          type="button"
          onClick={toggleMenuList}
          title={
            isMenuListCollapsed
              ? "Tampilkan Seluruh Daftar Menu"
              : "Sembunyikan Seluruh Daftar Menu"
          }
          className="px-2 py-1 rounded-lg bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          <i
            className={`fa-solid ${
              isMenuListCollapsed ? "fa-chevron-down" : "fa-chevron-up"
            } text-[9px]`}
          />
          <span>{isMenuListCollapsed ? "Tampilkan" : "Sembunyikan"}</span>
        </button>
      </div>

      {!isMenuListCollapsed && (
        <div className="space-y-4">
          {categories.map((cat) => {
            const items = nav.filter((n) => (n.category || "Menu Utama") === cat);
            return (
              <div key={cat} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {cat}
                </p>
                {items.map((item) => {
                  const isActive = pathname
                    ? item.href === "/admin" || item.href === "/guru"
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                    : false;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-50 to-sky-50/80 text-blue-700 border border-blue-200/80 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {item.icon ? (
                          <i
                            className={`${item.icon} text-sm w-4 text-center ${
                              isActive ? "text-blue-600" : "text-slate-400"
                            }`}
                          />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        )}
                        <span>{item.label}</span>
                      </span>

                      {item.badge ? (
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold ${
                            isActive
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarNavFallback({ nav }: { nav: NavItem[] }) {
  const categories = Array.from(new Set(nav.map((n) => n.category || "Menu Utama")));
  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const items = nav.filter((n) => (n.category || "Menu Utama") === cat);
        return (
          <div key={cat} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {cat}
            </p>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-slate-600 font-medium"
              >
                <span className="flex items-center gap-2.5">
                  {item.icon && <i className={`${item.icon} text-sm w-4 text-center text-slate-400`} />}
                  <span>{item.label}</span>
                </span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function SidebarNav({ nav }: { nav: NavItem[] }) {
  return (
    <Suspense fallback={<SidebarNavFallback nav={nav} />}>
      <SidebarNavInner nav={nav} />
    </Suspense>
  );
}
