import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Remove the "Made with Emergent" badge
const removeBadge = () => {
  // Method 1: Find by text content
  document.querySelectorAll('a, div, span, p, iframe').forEach(el => {
    const text = el.textContent || el.innerText || '';
    if (text.includes('Made with Emergent') || text.includes('Made with emergent')) {
      let target = el;
      // Walk up to find the outermost container that's not root
      while (target.parentElement && target.parentElement !== document.body && target.parentElement.id !== 'root') {
        target = target.parentElement;
      }
      if (target && target !== document.body && target.id !== 'root') {
        target.remove();
      }
    }
  });
  // Method 2: Find fixed-position elements at the bottom that aren't ours
  document.querySelectorAll('body > div:not(#root), body > a, body > iframe').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && parseInt(style.bottom) <= 20) {
      el.remove();
    }
  });
};
// Run on load and observe for dynamic injection
removeBadge();
const observer = new MutationObserver(() => { removeBadge(); });
observer.observe(document.body, { childList: true, subtree: false });
setTimeout(removeBadge, 500);
setTimeout(removeBadge, 1500);
setTimeout(removeBadge, 3000);
setTimeout(removeBadge, 5000);
