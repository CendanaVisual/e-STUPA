"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface SidebarLayoutContextValue {
  isSidebarHidden: boolean;
  toggleSidebar: () => void;
  showSidebar: () => void;
  hideSidebar: () => void;
}

const SidebarLayoutContext = createContext<SidebarLayoutContextValue>({
  isSidebarHidden: false,
  toggleSidebar: () => {},
  showSidebar: () => {},
  hideSidebar: () => {},
});

const STORAGE_KEY = "stupa_sidebar_hidden_v1";

export function SidebarLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1") {
        setIsSidebarHidden(true);
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, []);

  const updateState = (next: boolean) => {
    setIsSidebarHidden(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Abaikan
    }
  };

  const toggleSidebar = () => updateState(!isSidebarHidden);
  const showSidebar = () => updateState(false);
  const hideSidebar = () => updateState(true);

  return (
    <SidebarLayoutContext.Provider
      value={{ isSidebarHidden, toggleSidebar, showSidebar, hideSidebar }}
    >
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function CollapsibleSidebarAside({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarHidden } = useContext(SidebarLayoutContext);

  if (isSidebarHidden) {
    return null;
  }

  return (
    <aside className="w-full lg:w-72 bg-white/95 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-slate-200/90 flex flex-col justify-between shrink-0 z-30 shadow-sm relative transition-all duration-200">
      {children}
    </aside>
  );
}

export function SidebarHeaderHideButton() {
  const { hideSidebar } = useContext(SidebarLayoutContext);

  return (
    <button
      type="button"
      onClick={hideSidebar}
      title="Sembunyikan Daftar Menu Sidebar"
      className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-2xs shrink-0"
    >
      <i className="fa-solid fa-angles-left text-xs" />
    </button>
  );
}

export function TopbarSidebarToggleButton() {
  const { isSidebarHidden, toggleSidebar } = useContext(SidebarLayoutContext);

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={
        isSidebarHidden
          ? "Tampilkan Daftar Menu Sidebar Kiri"
          : "Sembunyikan Daftar Menu Sidebar Kiri"
      }
      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs ${
        isSidebarHidden
          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
          : "bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200/90 hover:border-blue-200"
      }`}
    >
      <i
        className={`fa-solid ${
          isSidebarHidden ? "fa-bars" : "fa-bars-staggered"
        } text-xs`}
      />
      <span className="hidden sm:inline text-[11px]">
        {isSidebarHidden ? "Tampilkan Menu" : "Sembunyikan Menu"}
      </span>
    </button>
  );
}
