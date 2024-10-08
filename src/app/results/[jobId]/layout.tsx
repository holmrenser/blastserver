"use client";
import React from "react";
import { ThemeContext } from "@/app/themecontext";
import { useContext } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme } = useContext(ThemeContext);
  return (
    <section
      className={`section hero is-fullheight ${
        theme === "dark" ? "has-background-dark has-text-light" : ""
      }`}
      style={{ paddingTop: "12px" }}
    >
      <div
        className="hero-body"
        style={{ padding: "0 !important", alignItems: "start" }}
      >
        {children}
      </div>
    </section>
  );
}
