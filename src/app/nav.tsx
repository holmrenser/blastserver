'use client'

import Link from 'next/link';
import { useContext, useRef, useEffect, useMemo } from 'react';

import { ThemeProvider, ThemeContext } from './themecontext';

import { QueueStatus } from './queuestatus';

//@ts-ignore
import { ALLOWED_FLAVOURS } from './[blastFlavour]/blastflavour.d.ts';
import Snowfall from 'react-snowfall';

function SantaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const img = useMemo(() => {
    const img = new Image();
    img.src = "santa-sled.png"
    img.id  = "santa_img";
    return img
  },[])
  
  const flip = false

  useEffect(() => {
    function draw (ctx: CanvasRenderingContext2D, flip: boolean) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.save();
      ctx.scale(flip ? -1 : 1, 1);
      ctx.drawImage(img, flip ? img.width * -1 : 0, Math.random()*(ctx.canvas.height-100), img.width, img.height);
      ctx.restore();
    }
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext('2d');
    if (context === null) return;
    img.onload = () => draw(context, false);

    function render(){
      if (context === null) return;
      draw(context, flip)
    }
  },[flip, img])

  return <canvas ref={canvasRef} />
}

export default function Nav(){
  const { theme, toggleTheme } = useContext(ThemeContext);
  return (
    <>
    <Snowfall />
    <nav className={`navbar ${theme === 'dark' ? 'is-dark' : 'is-light'}`} role="navigation" aria-label="main navigation">
      <div className="navbar-brand">
        <Link className="navbar-item" href="/">
          BLAST
        </Link>

        <a role="button" className="navbar-burger" aria-label="menu" aria-expanded="false" data-target="blast-navbar">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </a>
      </div>

      <div id="blast-navbar" className="navbar-menu">
        <div className="navbar-start">
          <div className="navbar-item has-dropdown is-hoverable">
            <a className="navbar-link">
              Flavours
            </a>

            <div className={`navbar-dropdown ${theme === 'dark' ? 'has-background-grey' : ''}`}>
              {
                ALLOWED_FLAVOURS.map(flavour => (
                  <Link className={`navbar-item ${theme === 'dark' ? 'has-background-grey has-text-white' : ''}`} href={`/${flavour}`} key={flavour}>
                    {flavour}
                  </Link>
                ))
              }
            </div>
          </div>
        </div>
        <div className='navbar-end'>
          <div className='navbar-item'>
            <div className='field'>
              <input
                id='theme-switch'
                type='checkbox'
                className='switch is-rtl is-rounded is-outlined is-warning is-small'
                checked={theme === 'light'}
                onChange={toggleTheme}
              />
              <label htmlFor='theme-switch' style={{fontSize:'1rem'}}>Toggle theme</label>
            </div>
          </div>
          <p className='navbar-item'>Queue</p>
          <div className='navbar-item'>
            <QueueStatus />
          </div>
        </div>
      </div>
    </nav>
    </>
  )
}