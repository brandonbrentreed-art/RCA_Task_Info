"use strict";

// icons.js — SVG path data and iconSvg() helper used across all pages.

const Icons = {
  home:     { viewBox: "0 0 24 24",    d: "M12 3l10 9h-3v8H5v-8H2l10-9z" },
  timeline: { viewBox: "0 0 24 24",    d: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm3.3 14.71L11 14.17V7h2v6.41l3.71 2.21-.42 1.09z" },
  ndp:      { viewBox: "0 0 24 24",    d: "M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" },
  ndc:      { viewBox: "0 0 24 24",    d: "M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z" },
  patrik:   { viewBox: "26 23 39 45",  d: "M 43.0,67.5 L 40.5,67.0 L 40.0,60.5 L 33.0,60.5 L 30.5,59.0 L 29.5,57.0 L 29.5,49.0 L 26.5,48.0 L 26.5,43.0 L 29.5,42.0 L 29.5,36.0 L 31.0,34.5 L 33.0,33.5 L 43.0,33.5 L 43.5,29.0 L 42.5,28.0 L 42.5,25.0 L 46.0,23.5 L 48.5,25.0 L 48.5,28.0 L 47.5,29.0 L 48.0,33.5 L 58.0,33.5 L 61.5,36.0 L 61.5,42.0 L 64.5,43.0 L 64.5,48.0 L 61.5,49.0 L 61.5,57.0 L 60.0,59.5 L 58.0,60.5 L 51.0,60.5 L 43.0,67.5 Z M 45.5,60.0 L 50.0,56.5 L 57.5,56.0 L 57.0,37.5 L 33.5,38.0 L 33.5,56.0 L 44.0,56.5 L 44.5,60.0 L 45.5,60.0 Z M 41.0,45.5 L 38.0,45.5 L 37.5,43.0 L 41.0,42.5 L 41.0,45.5 Z M 53.0,45.5 L 50.0,45.5 L 49.5,43.0 L 53.0,42.5 L 53.0,45.5 Z M 49.0,54.5 L 42.0,54.5 L 38.5,52.0 L 37.5,50.0 L 39.0,48.5 L 42.0,50.5 L 49.0,50.5 L 52.0,48.5 L 53.5,51.0 L 49.0,54.5 Z", fillRule: "evenodd" },
};

function iconSvg(key, attrs) {
  const icon = Icons[key];
  if (!icon) return "";
  const fill = (attrs && attrs.fill) || "currentColor";
  const size = (attrs && attrs.size) || "";
  const sizeAttrs = size ? ` width="${size}" height="${size}"` : "";
  const fillRule = icon.fillRule ? ` fill-rule="${icon.fillRule}"` : "";
  return `<svg viewBox="${icon.viewBox}" fill="${fill}"${sizeAttrs}><path d="${icon.d}"${fillRule}/></svg>`;
}
