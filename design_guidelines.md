{
  "project": {
    "name": "Regal Gold Jewellery Sales Suite",
    "visual_personality": [
      "Regal / premium showroom",
      "Japanese Kintsugi (gold repair veins)",
      "Royal velvet blue backdrops",
      "High-contrast, form-heavy workflows made calm",
      "Print output: heirloom invoice with calligraphy + ornamental borders"
    ],
    "audience": {
      "admins": "chain-level configuration, analytics, governance",
      "managers": "branch oversight + bill review/edit",
      "sales_executives": "tablet-first, fast entry + real-time calculation"
    },
    "success_actions": [
      "Create bill quickly with minimal errors",
      "Real-time totals visible at all times",
      "Manager can audit/approve bills confidently",
      "Admin can manage rates/branches/users/items and view performance"
    ]
  },

  "design_tokens": {
    "notes": [
      "Theme is dark (velvet blue) but content surfaces must remain readable via lighter card surfaces or translucent glass panels.",
      "Gold is used as accent (borders, focus rings, highlights), not as large gradients.",
      "Avoid heavy gradients; if used, keep to subtle velvet shifts in backgrounds only (<20% viewport)."
    ],

    "css_custom_properties": {
      "add_to_/app/frontend/src/index.css": {
        "strategy": "Replace :root + .dark HSL tokens with a single luxury token set; keep shadcn token names to avoid breaking components.",
        "tokens": ":root {\n  /* --- Velvet Blue + Kintsugi Gold (Luxury) --- */\n  --background: 226 45% 9%;        /* velvet navy */\n  --foreground: 40 35% 96%;        /* warm ivory */\n\n  --card: 226 36% 12%;             /* slightly lifted velvet panel */\n  --card-foreground: 40 35% 96%;\n\n  --popover: 226 36% 12%;\n  --popover-foreground: 40 35% 96%;\n\n  --primary: 44 82% 52%;           /* kintsugi gold */\n  --primary-foreground: 226 45% 9%;\n\n  --secondary: 226 28% 16%;        /* deep slate-blue */\n  --secondary-foreground: 40 35% 96%;\n\n  --muted: 226 22% 18%;\n  --muted-foreground: 40 10% 78%;\n\n  --accent: 42 65% 46%;            /* antique gold */\n  --accent-foreground: 226 45% 9%;\n\n  --destructive: 0 72% 52%;\n  --destructive-foreground: 40 35% 96%;\n\n  --border: 226 18% 24%;\n  --input: 226 18% 24%;\n  --ring: 44 82% 52%;              /* focus ring = gold */\n\n  --chart-1: 44 82% 52%;           /* gold */\n  --chart-2: 196 70% 52%;          /* jewel teal */\n  --chart-3: 270 35% 66%;          /* muted amethyst (NOT used in gradients) */\n  --chart-4: 14 78% 62%;           /* coral for alerts */\n  --chart-5: 160 52% 46%;          /* emerald */\n\n  --radius: 0.8rem;                /* premium soft geometry */\n\n  /* extra tokens (custom) */\n  --shadow-elev-1: 0 1px 0 hsl(226 38% 6% / 0.6), 0 12px 30px hsl(226 38% 4% / 0.45);\n  --shadow-elev-2: 0 1px 0 hsl(226 38% 6% / 0.65), 0 24px 70px hsl(226 38% 4% / 0.55);\n  --gold-foil: 44 90% 58%;\n  --gold-dim: 42 40% 45%;\n  --ivory: 40 35% 96%;\n  --ink: 226 45% 9%;\n}\n\n/* optional: keep .dark in sync (app is primarily dark) */\n.dark {\n  --background: 226 45% 9%;\n  --foreground: 40 35% 96%;\n  --card: 226 36% 12%;\n  --card-foreground: 40 35% 96%;\n  --popover: 226 36% 12%;\n  --popover-foreground: 40 35% 96%;\n  --primary: 44 82% 52%;\n  --primary-foreground: 226 45% 9%;\n  --secondary: 226 28% 16%;\n  --secondary-foreground: 40 35% 96%;\n  --muted: 226 22% 18%;\n  --muted-foreground: 40 10% 78%;\n  --accent: 42 65% 46%;\n  --accent-foreground: 226 45% 9%;\n  --destructive: 0 72% 52%;\n  --destructive-foreground: 40 35% 96%;\n  --border: 226 18% 24%;\n  --input: 226 18% 24%;\n  --ring: 44 82% 52%;\n }\n"
      }
    },

    "palette": {
      "backgrounds": {
        "velvet_900": "hsl(226 45% 9%)",
        "velvet_850": "hsl(226 40% 11%)",
        "velvet_panel": "hsl(226 36% 12%)",
        "ink": "hsl(226 45% 9%)",
        "ivory": "hsl(40 35% 96%)"
      },
      "gold": {
        "kintsugi_core": "hsl(44 82% 52%)",
        "antique": "hsl(42 65% 46%)",
        "dim": "hsl(42 40% 45%)"
      },
      "status": {
        "success": "hsl(160 52% 46%)",
        "warning": "hsl(38 85% 55%)",
        "danger": "hsl(0 72% 52%)",
        "info": "hsl(196 70% 52%)"
      }
    },

    "gradients_restricted": {
      "allowed_examples": [
        "Background only: linear-gradient(180deg, hsl(226 45% 9%) 0%, hsl(226 40% 11%) 60%, hsl(226 45% 9%) 100%)",
        "Decorative overlay (very subtle): radial-gradient(800px 400px at 20% 10%, hsl(44 82% 52% / 0.10), transparent 60%)"
      ],
      "prohibited_examples": [
        "blue-500 to purple-600",
        "purple-500 to pink-500",
        "green-500 to blue-500",
        "red to pink"
      ],
      "enforcement": "Never exceed 20% viewport coverage; never use gradients on cards or text-heavy areas; never on small UI elements (<100px width)."
    },

    "texture_and_background": {
      "kintsugi_background_recipe": [
        "Base: solid velvet blue background (bg-background)",
        "Overlay 1: subtle noise/grain via CSS (pseudo-element) opacity 0.08",
        "Overlay 2: kintsugi gold veins as SVG mask/PNG overlay (opacity 0.10–0.18) confined to page edges/corners",
        "Overlay 3 (optional): velvet sheen radial highlight behind top nav (opacity 0.08)"
      ],
      "css_scaffold": "/* page wrapper */\n.kintsugi-page {\n  position: relative;\n  background: hsl(var(--background));\n  color: hsl(var(--foreground));\n  overflow: hidden;\n}\n\n.kintsugi-page::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  background-image:\n    radial-gradient(900px 500px at 15% 10%, hsl(var(--gold-foil) / 0.10), transparent 65%),\n    radial-gradient(700px 420px at 80% 0%, hsl(196 70% 52% / 0.07), transparent 62%);\n  opacity: 1;\n}\n\n/* gold veins overlay: use background-image url(svg) */\n.kintsugi-page::after {\n  content: \"\";\n  position: absolute;\n  inset: -10%;\n  pointer-events: none;\n  background-image: url('/assets/kintsugi-veins.svg');\n  background-repeat: no-repeat;\n  background-position: center;\n  background-size: cover;\n  opacity: 0.14;\n  mix-blend-mode: screen;\n  filter: saturate(1.05) contrast(1.1);\n}\n\n/* grain */\n.noise-overlay {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  background-image: url('/assets/noise.png');\n  opacity: 0.08;\n  mix-blend-mode: overlay;\n}\n",
      "implementation_note": "Create /assets/kintsugi-veins.svg as a subtle gold-line pattern (thin strokes, blurred glow) with large negative space. Keep it faint for readability."
    },

    "shadows_and_radius": {
      "radius_scale": {
        "sm": "0.6rem",
        "md": "0.8rem",
        "lg": "1.0rem",
        "xl": "1.25rem"
      },
      "shadow_usage": {
        "cards": "shadow-[var(--shadow-elev-1)]",
        "modals": "shadow-[var(--shadow-elev-2)]",
        "focus": "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0"
      }
    }
  },

  "typography": {
    "font_pairing": {
      "headings": {
        "google_font": "Cormorant Garamond",
        "fallback": "ui-serif, Georgia",
        "use_cases": [
          "Login headline",
          "Dashboard section titles",
          "Bill print headings"
        ]
      },
      "body_ui": {
        "google_font": "Manrope",
        "fallback": "ui-sans-serif, system-ui",
        "use_cases": [
          "Forms",
          "Tables",
          "Navigation",
          "Microcopy"
        ]
      },
      "numbers": {
        "google_font": "IBM Plex Mono",
        "fallback": "ui-monospace, SFMono-Regular",
        "use_cases": [
          "Rates",
          "Weights",
          "Amounts (₹)",
          "Bill totals and analytics"
        ]
      }
    },
    "installation": {
      "method": "Google Fonts <link> in public/index.html OR @import in index.css (prefer link for performance)",
      "fonts": [
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      ]
    },
    "tailwind_usage": {
      "recommendation": "Set font-family via CSS variables and use utility classes like font-[var(--font-heading)].",
      "css_scaffold": ":root{ --font-heading: 'Cormorant Garamond'; --font-body: 'Manrope'; --font-mono: 'IBM Plex Mono'; }\n.heading { font-family: var(--font-heading); letter-spacing: 0.01em; }\n.body { font-family: var(--font-body); }\n.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }"
    },
    "type_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-[var(--font-heading)] tracking-tight",
      "h2": "text-base md:text-lg font-[var(--font-body)] text-[hsl(var(--muted-foreground))]",
      "section_title": "text-xl md:text-2xl font-[var(--font-heading)]",
      "table_header": "text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]",
      "amount": "font-[var(--font-mono)] tabular-nums"
    }
  },

  "layout": {
    "grid": {
      "app_shell": "min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr]",
      "content_max_width": "max-w-7xl",
      "page_padding": "px-4 sm:px-6 lg:px-8 py-6",
      "dashboard_cards": "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6",
      "forms": "grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6"
    },
    "navigation_pattern": {
      "desktop": "Left rail sidebar (Sheet on mobile) + top command strip",
      "mobile_tablet": "Top bar + bottom quick actions (Bill, Customer, Calculator, Print) as a compact Toolbar (not a full tab bar)"
    },
    "information_hierarchy_for_calculations": [
      "Always show a sticky right-side (or bottom on mobile) ‘Bill Summary’ card with: Subtotal, External charges, GST, Grand Total, Balance/Due.",
      "Group fields into 3-step accordions: 1) Rate & Purity 2) Item details (weights/stones) 3) Charges & Taxes.",
      "Use mono font for all numeric inputs and computed outputs.",
      "Use visual separators (Separator) between calculation groups; never rely on only whitespace." 
    ]
  },

  "components": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui/",
      "use_components": [
        {"name":"button","path":"/app/frontend/src/components/ui/button.jsx"},
        {"name":"card","path":"/app/frontend/src/components/ui/card.jsx"},
        {"name":"input","path":"/app/frontend/src/components/ui/input.jsx"},
        {"name":"label","path":"/app/frontend/src/components/ui/label.jsx"},
        {"name":"select","path":"/app/frontend/src/components/ui/select.jsx"},
        {"name":"tabs","path":"/app/frontend/src/components/ui/tabs.jsx"},
        {"name":"table","path":"/app/frontend/src/components/ui/table.jsx"},
        {"name":"dialog","path":"/app/frontend/src/components/ui/dialog.jsx"},
        {"name":"sheet","path":"/app/frontend/src/components/ui/sheet.jsx"},
        {"name":"accordion","path":"/app/frontend/src/components/ui/accordion.jsx"},
        {"name":"separator","path":"/app/frontend/src/components/ui/separator.jsx"},
        {"name":"tooltip","path":"/app/frontend/src/components/ui/tooltip.jsx"},
        {"name":"calendar","path":"/app/frontend/src/components/ui/calendar.jsx"},
        {"name":"sonner","path":"/app/frontend/src/components/ui/sonner.jsx"}
      ]
    },

    "button_system": {
      "style": "Luxury / Elegant",
      "tokens": {
        "radius": "rounded-[12px]",
        "primary": "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_1px_0_hsl(var(--gold-dim)/0.5),0_10px_24px_hsl(226_38%_4%/0.35)]",
        "primary_hover": "hover:brightness-[1.03] hover:shadow-[0_1px_0_hsl(var(--gold-foil)/0.65),0_14px_34px_hsl(226_38%_4%/0.45)]",
        "secondary": "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]",
        "ghost": "bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]",
        "motion": "transition-colors transition-shadow duration-200 active:scale-[0.99]"
      },
      "data_testid_examples": [
        "data-testid=\"login-form-submit-button\"",
        "data-testid=\"bill-summary-print-button\"",
        "data-testid=\"admin-rate-management-save-button\""
      ]
    },

    "forms_and_inputs": {
      "patterns": [
        "Use <Form> from shadcn (react-hook-form wrapper) if present; otherwise keep consistent Label + Input pairing.",
        "Numeric fields: use inputMode='decimal' and mono font class 'font-[var(--font-mono)] tabular-nums'.",
        "Add suffix/prefix chips inside input rows (₹, g, %) using inline Badge or muted span.",
        "Show computed values in read-only ‘Receipt row’ components: label left, amount right in mono."
      ],
      "recommended_field_row_classes": "grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end",
      "field_container": "md:col-span-6",
      "help_text": "text-xs text-[hsl(var(--muted-foreground))]"
    },

    "tables_and_density": {
      "goal": "Professional, audit-friendly tables on dark background",
      "classes": {
        "table_wrapper": "rounded-[14px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-elev-1)] overflow-hidden",
        "row_hover": "hover:bg-[hsl(var(--secondary))]",
        "amount_cell": "text-right font-[var(--font-mono)] tabular-nums"
      },
      "micro_interactions": [
        "Row hover reveals ‘Actions’ (edit/view/print) using opacity transition",
        "Sticky table header for long reports"
      ]
    },

    "cards_and_kintsugi_trim": {
      "card_style": "Velvet panel with thin gold hairline border only on key cards (summary, totals, approval).",
      "classes": {
        "default_card": "bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border border-[hsl(var(--border))] rounded-[var(--radius)] shadow-[var(--shadow-elev-1)]",
        "kintsugi_card": "relative overflow-hidden border border-[hsl(var(--border))] rounded-[16px] bg-[hsl(var(--card))] shadow-[var(--shadow-elev-1)]",
        "kintsugi_overlay": "after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[url('/assets/kintsugi-veins.svg')] after:bg-cover after:opacity-[0.10] after:mix-blend-mode-screen"
      }
    }
  },

  "page_blueprints": {
    "login": {
      "layout": "Split layout on desktop (left brand panel with kintsugi texture, right login card). On tablet/mobile: stacked with brand header above.",
      "key_components": ["Card", "Input", "Label", "Button", "Select"],
      "details": [
        "Brand panel includes showroom-like copy + subtle gold vein corners",
        "Login card has a thin gold top rule (2px) and embossed shadow",
        "Optional role switch (Admin/Manager/Sales) as Tabs"
      ]
    },
    "admin_dashboard": {
      "layout": "Sidebar navigation + content with KPI cards, management tables, and charts.",
      "kpi_cards": [
        "Today Sales (₹)",
        "Bills Created",
        "Average Ticket",
        "GST Collected"
      ],
      "charts": {
        "library": "Recharts",
        "style": "Use gold for primary series, teal/emerald for secondary; avoid neon. Add custom tooltip in Card with mono numbers."
      }
    },
    "manager_dashboard": {
      "layout": "Queue-based workflow: Pending approvals list left, selected bill detail right (on desktop). On tablet: Tabs (Queue / Bill Detail).",
      "bill_audit": [
        "Highlighted deltas when bill edited (use Badge ‘Edited’)",
        "Approval CTA sticky at bottom"
      ]
    },
    "sales_exec_flow": {
      "layout": "Wizard-like but non-blocking. Always accessible Bill Summary.",
      "steps": [
        "Customer capture",
        "Bill creation",
        "Add items (Gold/Diamond)",
        "Charges & GST",
        "Print / Send to Manager"
      ],
      "tablet_ux": [
        "Large touch targets: min-h-11 for buttons, inputs",
        "Use Drawer/Sheet for adding an item to keep context",
        "Sticky summary bar on mobile: total + primary action"
      ]
    },
    "bill_print": {
      "style": "Ivory paper surface with gold border filigree, calligraphic headings, mono numbers.",
      "implementation": [
        "Create a dedicated print CSS (media print) to switch background to white/ivory and hide app chrome.",
        "Use ornamental SVG border (thin, gold) around bill.",
        "Top: brand name in Cormorant Garamond, letterspacing; section headers with small caps.",
        "All amounts right-aligned in IBM Plex Mono."
      ],
      "print_css_scaffold": "@media print {\n  body { background: white !important; }\n  .no-print { display: none !important; }\n  .print-sheet {\n    color: #0b1020;\n    background: #fbf7ef;\n    -webkit-print-color-adjust: exact;\n    print-color-adjust: exact;\n  }\n}\n"
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Motion should feel like light on metal: subtle, directional, never bouncy.",
      "Use short durations (150–220ms) for hover; (220–320ms) for dialogs/sheets.",
      "Avoid universal transitions; only transition colors/shadow/opacity." 
    ],
    "examples": {
      "card_hover": "hover:shadow-[var(--shadow-elev-2)] hover:-translate-y-0.5 transition-shadow duration-200",
      "gold_focus": "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0",
      "nav_active": "Active item gets a 1px gold underline that animates width from 40%→100%"
    },
    "optional_library": {
      "name": "framer-motion",
      "use": "Entrance animations for dashboard cards and step transitions; keep subtle.",
      "install": "npm i framer-motion",
      "note": "Not mandatory; can be CSS-only if avoiding dependencies."
    }
  },

  "accessibility": {
    "rules": [
      "All form fields must have visible Label; placeholders are not labels.",
      "Focus state must be clearly visible (gold ring) on dark backgrounds.",
      "Minimum touch target 44px.",
      "Use tabular-nums for monetary columns.",
      "Color is never the only indicator: use icons + text for status (Approved/Pending/Edited)."
    ]
  },

  "testing_attributes": {
    "rule": "All interactive and key informational elements MUST include data-testid.",
    "naming": "kebab-case describing role, not appearance",
    "must_cover": [
      "login form inputs + submit",
      "sidebar nav links",
      "rate selection controls",
      "add item buttons",
      "calculation inputs",
      "gst toggle/select",
      "print button",
      "send-to-manager button",
      "manager approve/reject",
      "admin CRUD save/delete",
      "analytics date range picker"
    ]
  },

  "image_urls": {
    "background_textures": [
      {
        "category": "velvet-blue texture reference",
        "description": "Use as inspiration or as a very subtle blurred background layer (do not use as large sharp photo behind text).",
        "url": "https://images.unsplash.com/photo-1715816076351-7ee555307b59?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "deep blue abstract",
        "description": "Good as a base for ‘velvet’ feel when heavily blurred + darkened.",
        "url": "https://images.unsplash.com/photo-1619359059287-9d024d7081ef?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ],
    "gold_textures": [
      {
        "category": "gold foil reference",
        "description": "Use to derive gold sheen for icons/borders; do NOT place under text.",
        "url": "https://images.unsplash.com/photo-1656055450481-e47bc720e687?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ],
    "paper_texture_for_print": [
      {
        "category": "ivory paper reference",
        "description": "Use as a subtle print background texture at very low opacity (0.06–0.10).",
        "url": "https://images.unsplash.com/photo-1557434648-b751eefc92d0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ]
  },

  "instructions_to_main_agent": [
    "Update /app/frontend/src/App.css: remove CRA demo styles; do not center app container; keep App.css minimal or move styles to index.css/tailwind.",
    "Implement a reusable <KintsugiPage> wrapper component (JS) that applies kintsugi-page + noise overlay and wraps each route page.",
    "Create /public/assets/kintsugi-veins.svg and /public/assets/noise.png (or procedural CSS noise) and ensure opacity is subtle for readability.",
    "Use shadcn Sheet for mobile sidebar; Dialog for confirmations; Sonner for toasts.",
    "Ensure every actionable element includes data-testid (buttons, links, inputs, selects, table action menus).",
    "For calculation forms: build a sticky Bill Summary card that is always visible (desktop right rail, mobile bottom bar).",
    "Bill print view: use a dedicated route and @media print CSS; avoid dark backgrounds; ornamental border via SVG; calligraphy font ONLY for headings.",
    "Charts: Recharts with custom tooltip and gold/teal series; avoid gradients in chart areas; use subtle grid lines in border color."
  ]
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
