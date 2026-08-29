---
name: CareerForge AI
colors:
  surface: '#1d100c'
  surface-dim: '#1d100c'
  surface-bright: '#463630'
  surface-container-lowest: '#170b08'
  surface-container-low: '#261814'
  surface-container: '#2a1c18'
  surface-container-high: '#352722'
  surface-container-highest: '#41312c'
  on-surface: '#f7ddd5'
  on-surface-variant: '#e1bfb5'
  inverse-surface: '#f7ddd5'
  inverse-on-surface: '#3c2d28'
  outline: '#a98a80'
  outline-variant: '#594139'
  surface-tint: '#ffb59d'
  primary: '#ffb59d'
  on-primary: '#5d1900'
  primary-container: '#ff6b35'
  on-primary-container: '#5f1900'
  inverse-primary: '#ab3500'
  secondary: '#44e2cd'
  on-secondary: '#003731'
  secondary-container: '#03c6b2'
  on-secondary-container: '#004d44'
  tertiary: '#59d5fb'
  on-tertiary: '#003543'
  tertiary-container: '#00a7cb'
  on-tertiary-container: '#003744'
  error: '#F2545B'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59d'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#832600'
  secondary-fixed: '#62fae3'
  secondary-fixed-dim: '#3cddc7'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#b5ebff'
  tertiary-fixed-dim: '#59d5fb'
  on-tertiary-fixed: '#001f28'
  on-tertiary-fixed-variant: '#004e60'
  background: '#1d100c'
  on-background: '#f7ddd5'
  surface-variant: '#41312c'
  bg-base: '#0B0D10'
  bg-surface: '#15181D'
  bg-surface-raised: '#1D2127'
  bg-surface-hover: '#22262D'
  border-subtle: '#262A31'
  border-strong: '#383D45'
  text-primary: '#EDEEF1'
  text-secondary: '#9AA0AB'
  text-muted: '#5B6070'
  accent-ember: '#FF6B35'
  accent-ember-hover: '#FF8555'
  accent-ember-muted: '#3D2318'
  accent-steel: '#2DD4BF'
  accent-steel-muted: '#0F2E2B'
  success: '#3DD68C'
  warning: '#F5B84F'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-readout:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 16px
  margin-desktop: 32px
  margin-mobile: 16px
---

# CareerForge AI — Design Specification

> This document is written to be used as a design brief for Google Stitch (or any AI UI-generation tool). Each screen section is self-contained and can be pasted individually as a Stitch prompt, or the whole document can be used as project-level context.

---

## 1. Design Brief & Brand Personality

**Product:** CareerForge AI — an AI career-readiness platform (resume tailoring, mock interviews, job search, application tracking).

**Personality:** Confident, precise, forward-moving. The metaphor is a *forge* — raw material (a resume) goes in, heat and pressure (AI processing) are applied, and something stronger comes out. The UI should feel like a focused technical console, not a soft consumer app — closer to a developer tool or trading dashboard than a typical "job board" site, because the user is doing serious preparation work, not casually browsing.

**Tone of visual language:** Dark-first, high-contrast, precise typography, purposeful use of a warm accent color against a cool neutral base — literally evoking "ember on steel." Motion should feel mechanical and responsive (progress bars, live timelines, status transitions) rather than bouncy or playful.

**Primary theme:** Dark mode is the default and primary designed experience. Light mode is a secondary supported theme using the same token system inverted.

---

## 2. Implementation Stack Reference

This document is design-focused and intentionally stack-agnostic for feeding into Stitch or any other AI design tool. For reference, the frontend will ultimately be implemented with:

| Layer | Technology |
|---|---|
| Framework | Next.js (Pages Router), React 19 |
| Styling | Tailwind CSS — design tokens in Section 3 should map to a Tailwind theme config (colors, fontFamily, spacing, borderRadius extensions) |
| State management | Zustand |
| HTTP client | Axios |
| Real-time | Socket.IO client (drives the Processing Timeline component in Section 6.1) |
| File upload | react-dropzone (Resume Upload screen, Section 5.5) |
| Charts | recharts (Score Trend, Application Funnel, Weak Topic Heatmap) |
| Icons | lucide-react |

Any generated component output (from Stitch or otherwise) should be translated into React functional components using Tailwind utility classes, with colors/spacing/typography pulled from a shared `theme.js`/`tailwind.config.js` rather than hardcoded per component, so the design system in Section 3 stays the single source of truth.

Full backend/database/deployment stack is documented separately in `SPECS.md`, Section 2.

---

## 3. Design System

### 3.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#0B0D10` | App background (dark theme) |
| `bg-surface` | `#15181D` | Cards, panels, sidebar |
| `bg-surface-raised` | `#1D2127` | Modals, dropdowns, elevated elements |
| `bg-surface-hover` | `#22262D` | Hover state on surfaces |
| `border-subtle` | `#262A31` | Default borders, dividers |
| `border-strong` | `#383D45` | Focus rings, emphasized borders |
| `text-primary` | `#EDEEF1` | Headings, primary content |
| `text-secondary` | `#9AA0AB` | Body copy, descriptions |
| `text-muted` | `#5B6070` | Placeholder text, disabled states |
| `accent-ember` | `#FF6B35` | Primary accent — CTAs, active states, key highlights |
| `accent-ember-hover` | `#FF8555` | Hover state for ember accent |
| `accent-ember-muted` | `#3D2318` | Ember-tinted backgrounds (badges, subtle highlights) |
| `accent-steel` | `#2DD4BF` | Secondary accent — AI/processing elements, links, info states |
| `accent-steel-muted` | `#0F2E2B` | Steel-tinted backgrounds |
| `success` | `#3DD68C` | Resolved states, positive scores, offers |
| `warning` | `#F5B84F` | Pending states, medium scores |
| `error` | `#F2545B` | Failed states, low scores, destructive actions |
| `chart-1` … `chart-5` | `#FF6B35, #2DD4BF, #F5B84F, #8B7CF6, #3DD68C` | Chart series colors, in this order |

**Light theme mapping** (same tokens, inverted lightness): `bg-base → #F7F7F8`, `bg-surface → #FFFFFF`, `text-primary → #14161A`, `text-secondary → #565C68`, accents remain the same hex values for brand consistency.

### 3.2 Typography

| Role | Font | Weight | Size / Line-height |
|---|---|---|---|
| Display / Hero | Space Grotesk | 700 | 48px / 56px |
| Page Title (H1) | Space Grotesk | 600 | 32px / 40px |
| Section Title (H2) | Space Grotesk | 600 | 24px / 32px |
| Card Title (H3) | Space Grotesk | 600 | 18px / 26px |
| Body | Inter | 400 | 15px / 24px |
| Body Small | Inter | 400 | 13px / 20px |
| Label / Caption | Inter | 500 | 12px / 16px, letter-spacing 0.02em, uppercase for section labels |
| Monospace (scores, code, IDs) | JetBrains Mono | 500 | 14px / 20px |

Space Grotesk gives headings a slightly technical, geometric character (avoids the generic-SaaS feel of Inter-everywhere). Inter is used for body copy for maximum readability. JetBrains Mono is used specifically for numeric scores (ATS score, match %, session scores) to give them a "readout" feel, like a measurement.

### 3.3 Spacing Scale

Base unit: 4px. Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.
- Component internal padding: 16–24px
- Card padding: 24px
- Section gaps: 48–64px
- Page horizontal margin: 32px (desktop), 16px (mobile)

### 3.4 Radius, Elevation, Borders

- Small elements (badges, chips, buttons): `8px` radius
- Cards, panels, modals: `16px` radius
- Avatars, status dots: full circle
- Elevation is expressed with a **1px border** (`border-subtle`) plus a very soft outer glow (`0 0 0 1px rgba(255,107,53,0.08)` on hover/active for ember-accented elements) rather than heavy drop shadows — this keeps the dark theme feeling flat and precise rather than muddy.
- Active/selected cards get a 1.5px `accent-ember` border instead of a shadow.

### 3.5 Iconography

lucide-react icon set throughout. Icons are 20px in nav/toolbar contexts, 16px inline with text, 24px for empty-state illustrations. Icons use `text-secondary` by default and switch to `accent-ember` or `accent-steel` when representing an active/selected state.

### 3.6 Motion

- Standard transition: 160ms ease-out for hover/focus states
- Panel/modal entrance: 220ms ease-out, slight upward slide (8px) + fade
- Live processing timeline: each new agent-step entry slides in from the left with a 300ms stagger, mimicking a build/log console
- Progress bars use a subtle animated gradient sweep (ember → steel) while a job is `RUNNING`, and lock to solid `success` green when `COMPLETED`
