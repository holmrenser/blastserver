"use client";

import Link from "next/link";
import { useContext, useState } from "react";

import { ThemeContext } from "./themecontext";

import { QueueStatus } from "./queuestatus";

import { ALLOWED_FLAVOURS } from "./[blastFlavour]/parameters";

export default function Nav() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [showNav, setShowNav] = useState(false);
  return (
    <nav
      className={`navbar ${theme === "dark" ? "is-dark" : "is-light"}`}
      role="navigation"
      aria-label="main navigation"
    >
      <div className="navbar-brand">
        <Link className="navbar-item" href="/">
          BLAST
        </Link>

        <a
          role="button"
          className="navbar-burger"
          aria-label="menu"
          aria-expanded="false"
          data-target="blast-navbar"
          onClick={() => {
            setShowNav(!showNav);
          }}
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </a>
      </div>

      <div
        id="blast-navbar"
        className={`navbar-menu ${showNav ? "is-active" : ""} ${
          theme === "dark" ? "has-background-grey-dark" : ""
        }`}
      >
        <div className="navbar-start">
          <div className="navbar-item has-dropdown is-hoverable">
            <a
              className={`${
                theme === "dark" ? "has-text-light" : ""
              } navbar-link`}
            >
              Flavours
            </a>

            <div
              className={`navbar-dropdown ${
                theme === "dark" ? "has-background-grey-dark" : ""
              }`}
            >
              {ALLOWED_FLAVOURS.map((flavour) => (
                <Link
                  prefetch
                  className={`navbar-item ${
                    theme === "dark"
                      ? "has-background-grey-dark has-text-light"
                      : ""
                  }`}
                  href={`/${flavour}`}
                  key={flavour}
                >
                  {flavour}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="navbar-end">
          <div className="navbar-item">
            <div className="field">
              <input
                id="theme-switch"
                type="checkbox"
                className="switch is-rtl is-rounded is-outlined is-warning is-small"
                checked={theme === "light"}
                onChange={toggleTheme}
              />
              <label
                className={theme === "dark" ? "has-text-light" : ""}
                htmlFor="theme-switch"
                style={{ fontSize: "1rem" }}
              >
                Toggle theme
              </label>
            </div>
          </div>
          <p
            className={`navbar-item ${
              theme === "dark" ? "has-text-light" : ""
            }`}
          >
            Queue
          </p>
          <div className="navbar-item">
            <QueueStatus />
          </div>
        </div>
      </div>
    </nav>
  );
}
