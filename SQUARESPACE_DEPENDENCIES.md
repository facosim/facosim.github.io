# Squarespace Dependencies Analysis

## Overview
The FACO Simulations website is built on **Squarespace** (tangerine-maroon-c4cs.squarespace.com), a modern website platform. The site uses the Squarespace API and visitor rendering system to display dynamic content.

---

## 1. Core Squarespace Architecture

### Static Context Object
**Purpose:** Provides runtime configuration and metadata to JavaScript

```javascript
Static.SQUARESPACE_CONTEXT = {
  betaFeatureFlags: [...],     // 30+ beta features
  websiteSettings: {...},       // Site configuration
  storeType: "...",            // E-commerce type
  siteType: "...",             // Website category
  // ... more configuration
}
```

**Function:** This object is the "configuration source of truth" that tells the rendering engine:
- Which JavaScript features to enable/disable
- Commerce settings (products, cart, payments)
- Localization/i18n settings
- Template and styling options
- Analytics tracking
- Feature flags for testing

---

## 2. JavaScript Runtime System

### Core Scripts Loaded (in order):

#### 2.1 **Browser Compatibility Layer**
- `legacy.js` - IE11/older browser support (nomodule fallback)
- `modern.js` - ES6+ modules (default for modern browsers)

#### 2.2 **Vendor Libraries**
- `common-vendors-stable-*.js` - Stable third-party libraries (React, Lodash, etc.)
- `common-vendors-*.js` - Regular vendor bundle updates
- `extract-css-runtime-*.js` - CSS-in-JS runtime
- `cldr-resource-pack-*.js` - Internationalization data (CLDR)

#### 2.3 **Squarespace Core**
- `common-*.js` - Squarespace common utilities
- `user-account-core-*.js` - User authentication & account management (removed from this export)
- `site-bundle.*.js` - Main Squarespace site rendering engine

#### 2.4 **Component Rendering System**
These modules handle specific content types:

| Script | Purpose |
|--------|---------|
| `website.components.html.visitor.js` | Renders custom HTML blocks |
| `website.components.imagefluid.visitor.js` | Responsive image rendering |
| `website.components.imagefluid.shared.constants.js` | Image settings constants |
| `website.components.horizontalrule.visitor.js` | Horizontal rule styling |
| `website.components.shape.visitor.js` | SVG shape rendering |
| `website.components.button.visitor.js` | Button component styling |

#### 2.5 **Site-Specific Scripts**
- `rerouter.js` - Internal URL routing (replaces relative links)
- `fix-links.js` - Link validation and fixing
- `wod.js` - Custom "Word of the Day" functionality

#### 2.6 **Image Effects** (Optional)
```
image-effect-parallax.js          // Parallax scrolling
image-effect-liquid.js            // Liquid distortion
image-effect-refracted-circles.js // Refraction circles
image-effect-refracted-lines.js   // Refraction lines
image-effect-film-grain.js        // Vintage film effect
```

#### 2.7 **Content Management**
- `visitor-site-error-reporter-*.js` - Error tracking (removed from this export)
- Various numbered chunks (`2452.js`, `2513.js`, etc.) - Dynamic component loading

---

## 3. Data Attributes (Squarespace Markup)

### Block-Level Attributes

| Attribute | Occurrences | Purpose |
|-----------|------------|---------|
| `data-sqsp-block` | 14 | Identifies Squarespace content blocks |
| `data-sqsp-text-block-content` | 9 | Marks rich text content containers |
| `data-sqsp-image-block-image` | 5 | Image asset containers |
| `data-sqsp-image-block-link` | 5 | Clickable image hotspots |
| `data-sqsp-image-block-image-container` | 4 | Image wrapper divs |
| `data-sqsp-section` | 3 | Page section containers |

### How They Work:
1. **Block rendering:** When page loads, Squarespace scans for `data-sqsp-*` attributes
2. **Component matching:** JavaScript matches attributes to specific renderer modules
3. **Content injection:** Renderers populate blocks with content from Squarespace API
4. **Event binding:** Interactivity hooks are attached (clicks, hovers, etc.)

---

## 4. Content Components on This Site

### Types Present:

#### Text Blocks (9 instances)
- Rich text editor content
- Navigation menus
- Footer content
- Copyright notices

#### Image Blocks (14 instances)
- Product showcase images
- Hardware photos (T-6A, T-38C, etc.)
- Software feature screenshots
- Responsive image containers

#### Custom HTML Blocks (27 instances)
- Contact forms (Formspree integration)
- Navigation dropdowns
- Embedded widgets
- Menu structures

#### Sections (3 instances)
- Page layout containers
- Hero sections
- Content areas

---

## 5. Feature Flags (Beta Features Enabled)

The site has **30+ beta features** enabled. Key ones include:

### Commerce Features
- `product_block_editor_r2` - Product listing interface
- `product_list_filters_v2_separate_categories` - Advanced filters
- `commerce_product_payment_plan_editing` - Payment plans
- `enable_modernized_pdp_m3_fluid` - Modern product display

### Marketing & Campaigns
- `contacts_and_campaigns_redesign` - CRM integration
- `campaigns_import_discounts` - Bulk discount tools
- `marketing_automations` - Automated workflows
- `marketing_landing_page` - Landing page templates

### Developer Features
- `override_block_styles` - Custom CSS support
- `output_template_css_assets` - CSS asset export
- `scripts_defer` - Deferred script loading
- `nested_categories` - Hierarchical organization

### UI/UX
- `enable_modernized_pdp_m3_layout_ux` - Modern product page
- `campaigns_thumbnail_layout` - Visual grid layouts

---

## 6. Font System Integration

### Current Implementation
Squarespace provides the **Public Sans** font family with CDN delivery:

**Weights & Styles:**
- Normal weight 300 (Regular)
- Normal weight 700 (Bold)
- Italic weight 300
- Italic weight 700

**Delivery Method:**
- WOFF2 format via Squarespace CDN
- Per-region font files (Vietnamese, Latin, Latin-ext)
- Font display: `swap` (ensures text visible while loading)

**File Location:**
```
css/fonts.css  ← Consolidated font definitions (extracted in cleanup)
```

---

## 7. User Account System

The account client is not loaded by the current static export. Account/login services are therefore unavailable, while the visual layout remains unchanged.

### Features:
- **User authentication** - Login/password management
- **Account management** - Profile, settings
- **Member areas** - Gated content (members-only)

### Scripts Involved:
- `user-account-core-*.js` - Core account functionality (not loaded)
- Authentication flows managed through Squarespace API
- Session persistence via browser storage

---

## 8. E-Commerce System (Cart & Store)

The exported cart markup and styling remain in place for visual consistency, but no separate commerce service bundle is loaded by these pages. Checkout and server-backed cart operations should not be treated as available.

### Capabilities:
- **Shopping cart** - Product basket management
- **Product pages** - Dynamic product rendering
- **Category filtering** - Browse by type
- **Payment integration** - Stripe/Squarespace Payments
- **Order tracking** - Customer order history

### Entry Points:
- `cart.html` - Shopping cart page
- Product blocks in main content
- Formspree for contact/inquiry forms

---

## 9. Image Processing Pipeline

### Responsive Image System (ImageFluid):
1. **Upload:** Image uploaded to Squarespace CDN
2. **Detection:** Viewport size detected at runtime
3. **Optimization:** ImageFluid delivers optimized size/format
4. **Effects:** Optional effects applied (parallax, liquid, grain, etc.)
5. **Rendering:** Browser displays responsive image

### Supported Formats:
- JPEG (with optimization)
- WEBP (modern browsers)
- PNG (transparent backgrounds)
- Lazy loading support

---

## 10. Form Integration

### Contact Form System
- **Provider:** Formspree (external service)
- **Form action:** `https://formspree.io/f/[form-id]`
- **Method:** HTTP POST
- **Fields:** Email, message (custom fields possible)
- **Workflow:** Form submission → Email delivery → Squarespace CRM

---

## 11. How Squarespace Rendering Works (Workflow)

```
1. LOAD HTML FILE
   ↓
2. Load Static.SQUARESPACE_CONTEXT configuration
   ↓
3. Load vendor scripts (React, utilities, etc.)
   ↓
4. Initialize Squarespace runtime
   ↓
5. Scan DOM for data-sqsp-* attributes
   ↓
6. Load component-specific renderers
   ├─ website.components.html.visitor.js (if custom HTML)
   ├─ website.components.imagefluid.visitor.js (if images)
   ├─ website.components.button.visitor.js (if buttons)
   └─ ... other components
   ↓
7. Hydrate components with content
   ├─ Text content filled
   ├─ Images loaded via CDN
   ├─ Links routed through rerouter.js
   └─ Event handlers attached
   ↓
8. Apply styling from CSS/theme
   ↓
9. Bind interactivity
   ├─ Click handlers
   ├─ Form submissions
   ├─ Navigation
   └─ Analytics tracking
   ↓
10. PAGE READY
```

---

## 12. Performance Characteristics

### JavaScript Bundle Size
- **Total JS:** ~26 script tags
- **Strategy:** Code splitting (chunks like `2452.js`, `2513.js`)
- **Loading:** Deferred loading enabled (via `scripts_defer` flag)
- **Format:** Minified ES6+ modules

### CSS Delivery
- **Font CSS:** Externalized in `css/fonts.css` (5.8 KB)
- **Inline styles:** 29 instances of inline CSS (from component rendering)
- **Font loading:** Swap strategy (text visible immediately)

### Image Optimization
- **CDN:** Squarespace CDN (images.squarespace-cdn.com)
- **Formats:** Auto-selection (WEBP for modern, JPEG fallback)
- **Lazy loading:** Implemented via data-src attributes

---

## 13. Dependencies Summary Table

| Component | Type | Count | Purpose |
|-----------|------|-------|---------|
| Scripts | JS Files | 26 | Core functionality |
| Blocks | Content | 14 | Page content containers |
| Text Blocks | Content | 9 | Rich text areas |
| Image Blocks | Content | 14 | Image containers |
| Custom HTML | Content | 27 | Custom markup |
| Sections | Layout | 3 | Page structure |
| Fonts | CSS | 12 | Typography |
| Data Attributes | Markup | 6 types | Component identification |

---

## 14. External Dependencies

### Third-Party Services
1. **Squarespace CDN** - Image hosting and CDN
2. **Formspree** - Form submission handler
3. **Google Fonts CDN** - Font delivery (was direct CDN calls)
4. **Analytics** - Squarespace tracking (via Static context)

### API Endpoints Used
- Squarespace API for content delivery
- Formspree API for form processing
- CDN endpoints for images and fonts

---

## 15. Maintenance & Updates

### How Squarespace Manages Updates:
1. **Code splitting:** Features are in separate JS files
2. **Beta flags:** New features can be enabled/disabled per site
3. **Vendor bundling:** Common libraries are bundled separately
4. **Cache busting:** File hashes in names (e.g., `site-bundle.f8068e4a...js`)

### Site-Specific Customizations:
- `rerouter.js` - Custom URL handling
- `fix-links.js` - Link correction logic
- `wod.js` - "Word of the Day" feature
- `css/fonts.css` - Font definitions
- Custom image effects

---

## 16. Security Features

### Built-in Squarespace Security:
- **HTTPS:** All Squarespace sites use SSL/TLS
- **CSP headers:** Content Security Policy
- **XSS protection:** HTML sanitization in text blocks
- **CSRF tokens:** Form security (Formspree handles this)
- **Authentication:** User account session management

---

## Conclusion

The FACO Simulations website leverages Squarespace's **powerful content delivery and component rendering system**. The architecture uses:

- **30+ beta features** for advanced functionality
- **Component-based rendering** for flexibility
- **Optimized image pipeline** for performance
- **Integrated e-commerce** for product sales
- **Form handling** via Formspree
- **Font optimization** with proper CSS extraction

The recent code cleanup **consolidated font definitions** into an external stylesheet, improving maintainability while preserving all Squarespace functionality.
