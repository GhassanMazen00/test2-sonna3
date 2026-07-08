// ============================================
// ICONS LIBRARY — original inline SVG icons (no emojis)
// ============================================
//
// Every icon here is a small, original SVG drawn on a 24×24 grid. Each one
// automatically takes the COLOR and SIZE of the text around it (via
// `currentColor` and the `svg-ic` CSS class), so it behaves just like the
// emoji it replaced.
//
// HOW TO USE: write ICONS.name where you want an icon, e.g.
//   '<span class="thumb">' + ICONS.factory + '</span>'
//
// TO CHANGE AN ICON: edit the path data inside the matching line below. You can
// ask the AI, e.g. "make the ICONS.factory icon taller". Loaded first (before
// the other scripts) so every file can use it.

(function () {
  // Line/outline icon (most icons)
  function L(paths) {
    return '<svg class="svg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  // Solid/filled icon (a few, like stars)
  function F(paths) {
    return '<svg class="svg-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + paths + '</svg>';
  }

  window.ICONS = {
    // --- Industries ---
    textile:      L('<rect x="6" y="4" width="12" height="16" rx="1.5"/><path d="M6 8h12M6 16h12M9.5 8v8M14.5 8v8"/>'),
    box:          L('<path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5V21.5"/>'),
    furniture:    L('<path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><rect x="4" y="10" width="16" height="6" rx="2"/><path d="M6 16v3M18 16v3"/>'),
    food:         L('<path d="M4 13c0-3.3 3.6-5 8-5s8 1.7 8 5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M8.5 11l1-2M12 10.5l1-2M15.5 11l1-2"/>'),
    plastics:     L('<path d="M10 3h4v3l1.4 2.5a3 3 0 0 1 .6 1.8V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-8.7a3 3 0 0 1 .6-1.8L10 6z"/><path d="M9 13h6"/>'),
    gear:         L('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3.2M12 18.3v3.2M21.5 12h-3.2M5.7 12H2.5M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3M18.7 18.7l-2.3-2.3M7.6 7.6 5.3 5.3"/>'),
    chemicals:    L('<path d="M9 3h6M10 3v5.5L5.6 17A2 2 0 0 0 7.4 20h9.2a2 2 0 0 0 1.8-3L14 8.5V3"/><path d="M8 15h8"/>'),
    cosmetics:    L('<path d="M9 9l1.5-5 3 1-1 4z"/><rect x="8.5" y="9" width="6" height="3" rx="1"/><rect x="9" y="12" width="5" height="9" rx="1"/>'),
    construction: L('<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M3.5 9.7h17M3.5 14.3h17M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>'),
    medical:      L('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),
    promo:        L('<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/><path d="M12 8.5V20.5"/><path d="M12 8.5C11 5 9.5 4 8 5s1 3.5 4 3.5zM12 8.5C13 5 14.5 4 16 5s-1 3.5-4 3.5z"/>'),
    electronics:  L('<path d="M9 3v5M15 3v5"/><path d="M7 8h10v2a5 5 0 0 1-10 0z"/><path d="M12 15v6"/>'),
    agriculture:  L('<path d="M12 21V8"/><path d="M12 8c0-2.2 1.6-3.4 3.4-3.4C15.4 6.8 13.8 8 12 8zM12 8c0-2.2-1.6-3.4-3.4-3.4C8.6 6.8 10.2 8 12 8zM12 13.5c0-2.2 1.6-3.4 3.4-3.4 0 2.2-1.6 3.4-3.4 3.4zM12 13.5c0-2.2-1.6-3.4-3.4-3.4 0 2.2 1.6 3.4 3.4 3.4z"/>'),
    automotive:   L('<path d="M5 12l1.7-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.9 1.3L19 12"/><path d="M4 12h16a1 1 0 0 1 1 1v3.5H3V13a1 1 0 0 1 1-1z"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>'),

    // --- Products / services / misc ---
    printer:    L('<path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="8" rx="1"/><path d="M7 15h10v5H7z"/><path d="M16.5 11h.01"/>'),
    scissors:   L('<circle cx="6" cy="6.5" r="2.2"/><circle cx="6" cy="17.5" r="2.2"/><path d="M8 7.5l12 8M8 16.5l12-8"/>'),
    palette:    L('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-1.4 1-2.2 2.2-2.2H18a3 3 0 0 0 3-3c0-4.4-4-8-9-8z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="11" r="1"/>'),
    ruler:      L('<path d="M4.5 4v14.5a1 1 0 0 0 1 1H20z"/><path d="M4.5 9.5h3M4.5 13.5h6"/>'),
    tag:        L('<path d="M12.5 3.5H5A1.5 1.5 0 0 0 3.5 5v7.5a1.5 1.5 0 0 0 .44 1.06l7.5 7.5a1.5 1.5 0 0 0 2.12 0l7.5-7.5a1.5 1.5 0 0 0 0-2.12l-7.5-7.5A1.5 1.5 0 0 0 12.5 3.5z"/><circle cx="8" cy="8" r="1.3"/>'),
    wrench:     L('<path d="M14.7 6.3a4 4 0 0 0-5 5l-6 6a1.5 1.5 0 0 0 0 2.1l.9.9a1.5 1.5 0 0 0 2.1 0l6-6a4 4 0 0 0 5-5l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    truck:      L('<rect x="2.5" y="6" width="12" height="9" rx="1"/><path d="M14.5 9h3.2l2.8 3v3h-6z"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>'),
    microscope: L('<path d="M6 21h14"/><path d="M9 21a6 6 0 0 0 5.5-8.4"/><rect x="9.2" y="4" width="3.2" height="9" rx="1.4" transform="rotate(18 10.8 8.5)"/><path d="M8 15.5h4"/>'),
    testtube:   L('<path d="M9 3h6M10 3v15a2 2 0 0 0 4 0V3M10 13h4"/>'),
    clipboard:  L('<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.8" width="6" height="3.4" rx="1"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>'),

    // --- UI / decorative ---
    factory:   L('<path d="M3 21V10l6 3.5V10l6 3.5V7l6 3.5V21z"/><path d="M3 21h18M7 17h2M12 17h2"/>'),
    compass:   L('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/><circle cx="12" cy="12" r="0.5"/>'),
    megaphone: L('<path d="M4 10v4a1 1 0 0 0 1 1h2.5L14 19V5L7.5 9H5a1 1 0 0 0-1 1z"/><path d="M17 9a4 4 0 0 1 0 6"/>'),
    handshake: L('<path d="M11 6.5 8.5 4.5 2.5 8l2 6 2.5-1"/><path d="M13 6.5l2.5-2 6 3.5-2 6-2.5-1"/><path d="M7 13l3 2.5 2-1.5 2.5 2 1.5-1.5"/>'),
    globe:     L('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18z"/>'),
    pin:       L('<path d="M12 21s-6.5-6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>'),
    paperclip: L('<path d="M20 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3 3 0 0 1 4.3 4.3l-8.5 8.5a1 1 0 0 1-1.6-1.6l7.8-7.8"/>'),
    note:      L('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    search:    L('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    chartBar:  L('<path d="M4.5 3.5v16.5h16"/><path d="M8.5 20v-5M13 20v-8M17.5 20v-3"/>'),
    chartLine: L('<path d="M4 4v16h16"/><path d="M7 14.5l3.2-3.5 3 2.2 4.8-5.7"/>'),
    camera:    L('<rect x="3" y="7" width="18" height="12.5" rx="2.5"/><circle cx="12" cy="13.2" r="3.2"/><path d="M8.5 7l1.4-2.2h4.2L15.5 7"/>'),
    phone:     L('<path d="M6.5 3.5h3l1.5 4.5-2 1.4a11 11 0 0 0 5.1 5.1l1.4-2 4.5 1.5v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.5 5.6a2 2 0 0 1 2-2.1z"/>'),
    chat:      L('<path d="M4.5 5.5h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10l-4.5 3.5V15.5H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/><path d="M8 9.5h8M8 12.5h5"/>'),
    envelope:  L('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
    clock:     L('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>'),
    home:      L('<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5V14h4v5.5"/>'),
    menu:      L('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close:     L('<path d="M6 6l12 12M18 6 6 18"/>'),
    check:     L('<path d="M4.5 12.5l5 5 10-11"/>'),
    recycle:   L('<path d="M9 6.5l2.2-3.4a1 1 0 0 1 1.6 0L15 6.5"/><path d="M18.2 11l1.9 3.3a1 1 0 0 1-.8 1.5l-3.8.3"/><path d="M8.5 16.1l-3.8-.3a1 1 0 0 1-.8-1.5L5.8 11"/><path d="M15 6.5l-1.7 1M15.9 16.1l-.7-1.8M8.1 14.3l-1.8.7"/>'),
    flag:      L('<path d="M5 3v18"/><path d="M5 4.5h12l-2.5 3.5L17 11.5H5z"/>'),
    shirt:     L('<path d="M8 4 4 6.5 6 10l2-1v11h8V9l2 1 2-3.5L16 4a2.5 2.5 0 0 1-8 0z"/>'),
    jar:       L('<path d="M8 8h8M9 5h6"/><path d="M8 8v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8"/><path d="M9 5V4h6v1"/>'),
    star:        F('<path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.1 6.1-.7z"/>'),
    starOutline: L('<path d="M12 3.8l2.5 5.3 5.8.7-4.3 3.9 1.1 5.7-5.1-2.8-5.1 2.8 1.1-5.7L3.7 9.8l5.8-.7z"/>'),
    sparkle:     F('<path d="M12 2l1.8 6.5L20 10l-6.2 1.5L12 18l-1.8-6.5L4 10l6.2-1.5z"/>')
  };
})();
