"use client";

import Link from "next/link";
import { useContext, useState } from "react";

import { ThemeContext } from "./themecontext";

import { QueueStatus } from "./queuestatus";

//@ts-ignore
import { ALLOWED_FLAVOURS } from "./[blastFlavour]/blastflavour.d.ts";
// import Snowfall from "react-snowfall";
/*
function SantaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [flip, setFlip] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = "https://www.bioinformatics.nl/~holme003/santa-sled.png";
    img.id = "santa_img";
    img.onload = () => {
      imgRef.current = img;
      draw({ flip });
    };
  }, [flip]);

  function draw({ flip }: { flip: boolean }) {
    const ctx = canvasRef?.current?.getContext("2d");
    const img = imgRef?.current;
    // console.log({ img })

    if (!ctx || !img) {
      return;
    }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(
      img,
      flip ? 200 * -1 : 0,
      Math.random() * (ctx.canvas.height - 100),
      200,
      93
    );
    ctx.restore();
  }

  function animationIteration() {
    setFlip(!flip);
    draw({ flip });
  }
  return (
    <>
      <style type="text/css">
        {`
      @keyframes slidein {
        0% {
          left: 100%;
        }
        15% {
          left: 100%;
        } 
        90% {
          left: -200px;
        }
        100% {
          left: -200px;
        }
      }
      `}
      </style>
      <div
        className="slidein"
        id="santa_animation"
        onAnimationIteration={animationIteration}
        style={{
          position: "fixed",
          animationDuration: "3s",
          animationName: "slidein",
          animationIterationCount: "infinite",
          animationDirection: "alternate",
          zIndex: 79,
        }}
      >
        <canvas
          className="santa"
          id="santa_canvas"
          ref={canvasRef}
          width="1000"
          height="800"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        />
      </div>
    </>
  );
}
*/
export default function Nav() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [showNav, setShowNav] = useState(false);
  return (
    <>
      {/* It's not christmas
      <Snowfall />
      <SantaCanvas />
      */}
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
    </>
  );
}
