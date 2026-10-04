const STYLE_ID = "autolancer-agent-style-block";

export const AUTOLANCER_HIGHLIGHT_CLASSES = {
  base: "autolancer-highlight-base",
  child: "autolancer-highlight-child",
  parent: "autolancer-highlight-parent",
  submit: "autolancer-highlight-submit",
  input: "autolancer-input-enhanced",
  cursor: "autolancer-input-cursor",
  cursorLogo: "autolancer-cursor-logo",
  cursorLogoWrapper: "autolancer-cursor-logo-wrapper",
  menu: "autolancer-bot-menu",
  menuItem: "autolancer-menu-item",
  mirror: "autolancer-input-mirror",
};

const styleContent = `
/* 
   ==========================================================================
   1. Agent Highlight Classes (Restored Visual Flair - Optimized)
   ==========================================================================
   These classes apply "Glow" effects without heavy mask-image processing.
*/

.autolancer-highlight-base {
    position: relative;
    border-radius: 8px;
    transition: box-shadow 0.3s ease, border-color 0.3s ease;
    /* Cyan Glow */
    box-shadow: 0 0 0 2px rgba(0, 198, 255, 0.6), 0 0 15px rgba(0, 198, 255, 0.25);
    z-index: 10;
}

.autolancer-highlight-child {
    border-radius: 6px;
    /* Red/Pink Glow */
    box-shadow: 0 0 0 2px rgba(255, 65, 108, 0.6), 0 0 12px rgba(255, 65, 108, 0.25);
}

.autolancer-highlight-parent {
    border-radius: 8px;
    /* Green/Nature Glow */
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.5), 0 0 15px rgba(34, 197, 94, 0.2);
}

.autolancer-highlight-submit {
    border-radius: 6px;
    /* Deep Blue/Action Glow */
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.7), 0 0 15px rgba(59, 130, 246, 0.35);
}

/* 
   ==========================================================================
   2. Input Field Enhancement
   ==========================================================================
   Background remains transparent/native. 
   Only Border and Box-Shadow are modified on focus.
*/
.autolancer-input-enhanced {
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.autolancer-input-enhanced:focus {
    outline: none !important;
    border-color: #00c6ff !important;
    /* The "Smart" Glow effect when typing */
    box-shadow: 0 0 0 1px #00c6ff, 0 0 12px rgba(0, 198, 255, 0.4) !important;
}

/* 
   ==========================================================================
   3. Floating Cursor (Logo)
   ==========================================================================
*/
.autolancer-input-cursor {
    position: fixed;
    display: none;
    align-items: center;
    pointer-events: none; 
    z-index: 2147483643;
    transform: translateY(-50%);
    margin-left: 2px; 
}

.autolancer-cursor-logo-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto; 
    padding: 2px;
}

/* Hit area for menu hover stability */
.autolancer-cursor-logo-wrapper::before {
    content: "";
    position: absolute;
    top: -10px;
    bottom: -15px;
    left: -10px;
    right: -10px;
}

.autolancer-cursor-logo {
    width: 22px; 
    height: 22px;
    border-radius: 50%;
    padding: 2px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    display: block;
    object-fit: contain;
}

.autolancer-cursor-logo:hover {
    transform: scale(1.15);
    box-shadow: 0 4px 10px rgba(0, 198, 255, 0.3);
    border-color: #00c6ff;
}

/* 
   ==========================================================================
   4. Dropdown Menu
   ==========================================================================
*/
.autolancer-bot-menu {
    position: absolute;
    top: 120%;
    left: 0;
    min-width: 150px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 5px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05);
    
    opacity: 0;
    visibility: hidden;
    transform: translateY(8px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
    z-index: 2147483644;
}

.autolancer-cursor-logo-wrapper:hover .autolancer-bot-menu,
.autolancer-bot-menu:hover {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
}

.autolancer-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    font-family: system-ui, -apple-system, sans-serif;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.autolancer-menu-item:hover {
    background: linear-gradient(90deg, #eff6ff, #f3f4f6);
    color: #0080ff;
}

.autolancer-menu-item::before {
    content: "⚡";
    font-size: 12px;
}

/* 
   ==========================================================================
   5. Technical (Mirror)
   ==========================================================================
*/
.autolancer-input-mirror {
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
    pointer-events: none;
    z-index: -1;
    top: 0;
    left: -9999px;
    opacity: 0;
}
`;

export function ensureAgentStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styleContent;
  (document.head || document.documentElement || document.body).appendChild(style);
}
