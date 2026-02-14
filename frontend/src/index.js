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
  document.querySelectorAll('a, div, span').forEach(el => {
    if (el.textContent && el.textContent.includes('Made with Emergent')) {
      let target = el;
      // Walk up to find the outermost fixed container
      while (target.parentElement && target.parentElement !== document.body && target.parentElement.id !== 'root') {
        target = target.parentElement;
      }
      if (target && target !== document.body && target.id !== 'root') {
        target.style.display = 'none';
      }
    }
  });
};
// Run on load and observe for dynamic injection
removeBadge();
const observer = new MutationObserver(removeBadge);
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(removeBadge, 1000);
setTimeout(removeBadge, 3000);
