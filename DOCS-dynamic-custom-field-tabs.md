# Dynamic Custom Field Tabs — Implementation Reference

Concise reference for the **prod-customFields-mod** feature: new files, modifications to existing files, and code snippets with explanations.

---

## 1. New Files Created

### 1.1 Custom product page template

**Path:** `templates/pages/custom/product/prod-customFields-mod.html`

**Purpose:** Product page layout that enables dynamic tabs from custom fields. Must live under `custom/product/` so Stencil recognizes it as a product layout.

**Snippet:**

```html
---
product:
    videos:
        limit: {{theme_settings.productpage_videos_count}}
    reviews:
        limit: {{theme_settings.productpage_reviews_count}}
    related_products:
        limit: {{theme_settings.productpage_related_products_count}}
    similar_by_views:
        limit: {{theme_settings.productpage_similar_by_views_count}}
---
{{inject 'productId' product.id}}
{{inject 'productUseDynamicCustomFieldTabs' true}}
{{inject 'productCustomFields' product.custom_fields}}

{{#partial "page"}}
    ...
    {{> components/products/product-view-custom-fields}}
    ...
{{/partial}}
{{> layout/base}}
```

**Explanation:**
- **Front matter** matches default `product.html` so the page has product context (videos, reviews, related, similar).
- **`productUseDynamicCustomFieldTabs`** — flag so the product JS only runs the dynamic-tab logic on this template.
- **`productCustomFields`** — passes `product.custom_fields` into the JS context for parsing.
- **`product-view-custom-fields`** — uses the custom product view (no inline custom fields, custom tabs + leading-fields anchor).

---

### 1.2 Description tabs with dynamic placeholders

**Path:** `templates/components/products/description-tabs-with-dynamic-fields.html`

**Purpose:** Same as default description tabs (Description, Warranty, Reviews) but adds hidden anchors where JS injects dynamic tab labels and tab content.

**Snippet:**

```html
<ul class="tabs" data-tab>
    {{!-- ... Description, Warranty tabs ... --}}
    {{!-- Dynamic custom field tabs (from __newtab) are injected here by JS --}}
    <li id="product-dynamic-cf-tabs-anchor" class="u-hiddenVisually" aria-hidden="true"></li>
    {{#all settings.show_product_reviews ...}}
        <li class="tab">...Reviews...</li>
    {{/all}}
</ul>
<div class="tabs-contents">
    {{!-- ... Description, Warranty content ... --}}
    {{!-- Dynamic custom field tab content injected here by JS --}}
    <div id="product-dynamic-cf-content-anchor" class="u-hiddenVisually" aria-hidden="true"></div>
    {{#all settings.show_product_reviews ...}}
       <div class="tab-content" id="tab-reviews">...</div>
    {{/all}}
</div>
```

**Explanation:**
- **`#product-dynamic-cf-tabs-anchor`** — JS inserts new `<li class="tab">` elements before this (tab labels).
- **`#product-dynamic-cf-content-anchor`** — JS inserts new `<div class="tab-content">` panels before this.
- Anchors are hidden so they don’t affect layout; they only define insertion points.

---

### 1.3 Product view for custom template

**Path:** `templates/components/products/product-view-custom-fields.html`

**Purpose:** Copy of default `product-view.html` with three customizations so custom fields are shown as leading fields + dynamic tabs only.

**Customizations:**

1. **No inline custom fields**  
   The default view includes:
   ```html
   {{#if theme_settings.show_custom_fields_tabs '!==' true}}
       {{> components/products/custom-fields }}
   {{/if}}
   ```  
   This block is **removed**. Custom fields are never rendered inline via the partial.

2. **Leading-fields anchor in product info `<dl>`**  
   After the bulk discount block and before `</dl>`, add:
   ```html
   {{!-- Leading custom fields (before first __newtab) injected here by JS --}}
   <dt id="product-leading-custom-fields-anchor" class="u-hiddenVisually" aria-hidden="true" style="display: none;"></dt>
   ```  
   JS injects `<dt>`/`<dd>` pairs for custom fields that appear *before* the first `__newtab` trigger.

3. **Description block always uses custom tabs component**  
   Replace the conditional that chooses between `description-tabs` and `description` with:
   ```html
   <article class="productView-description" data-product-dynamic-cf-tabs>
       {{> components/products/description-tabs-with-dynamic-fields}}
   </article>
   ```  
   So this template always uses the tab layout and the anchors for dynamic tabs.

---

### 1.4 Dynamic custom field tabs script

**Path:** `assets/js/theme/product/dynamic-custom-field-tabs.js`

**Purpose:** Parses `product.custom_fields`, splits into “leading” (pre–first `__newtab`) and “tabs” (from first `__newtab` onward), injects leading fields into the product info area and dynamic tab markup into the tab area, and binds tab clicks.

**Snippets with explanations:**

**Trigger check (case-insensitive):**
```javascript
const NEWTAB_TRIGGER_NAME = '__newtab';

function isNewTabTrigger(name) {
    return name && String(name).trim().toLowerCase() === NEWTAB_TRIGGER_NAME;
}
```
Any custom field whose **name** (trimmed, lowercased) equals `__newtab` starts a new tab; its **value** is the tab label. The trigger row itself is never shown.

**Split: leading fields vs tabs:**
```javascript
export function groupCustomFieldsIntoTabs(customFields) {
    const result = { leadingFields: [], tabs: [] };
    // ...
    customFields.forEach((field) => {
        const name = field.name && String(field.name).trim();
        const value = field.value != null ? field.value : '';

        if (isNewTabTrigger(name)) {
            seenFirstTrigger = true;
            currentTab = { label: value.trim() || 'Details', slug: slugify(...), fields: [] };
            tabs.push(currentTab);
        } else if (name) {
            if (seenFirstTrigger && currentTab) {
                currentTab.fields.push({ name, value });
            } else {
                result.leadingFields.push({ name, value });
            }
        }
    });
    result.tabs = tabs;
    return result;
}
```
- Fields **before** the first `__newtab` → `leadingFields` (shown in product info).
- From the first `__newtab` onward, each trigger starts a new tab; following fields go into that tab until the next trigger.

**Inject leading fields:**
```javascript
function injectLeadingCustomFields(leadingFields) {
    const anchor = document.getElementById('product-leading-custom-fields-anchor');
    if (!anchor) return;
    const frag = document.createDocumentFragment();
    leadingFields.forEach((field) => {
        const dt = document.createElement('dt');
        dt.className = 'productView-info-name';
        dt.textContent = `${field.name}:`;
        const dd = document.createElement('dd');
        dd.className = 'productView-info-value';
        dd.innerHTML = field.value;
        frag.appendChild(dt);
        frag.appendChild(dd);
    });
    anchor.parentNode.insertBefore(frag, anchor);
}
```
Builds one `<dt>`/`<dd>` per leading field and inserts them in a single operation before the anchor to match the rest of the product info styling.

**Inject dynamic tabs:**
```javascript
function injectDynamicTabs(tabs) {
    const $listAnchor = $('#product-dynamic-cf-tabs-anchor');
    const $contentAnchor = $('#product-dynamic-cf-content-anchor');
    // Build fragment of <li class="tab"> for each tab, and fragment of <div class="tab-content"> with <dl> of fields
    $listAnchor.before(tabListFrag);
    $contentAnchor.before(contentFrag);
}
```
Tab labels get IDs like `#tab-dynamic-{slug}-{index}`; each panel has a matching `id` so tab links work. Tab label text is escaped; field values use `innerHTML` (supports HTML in custom fields).

**Tab click handling:**
```javascript
function bindDynamicTabClicks() {
    $(document).on('click', '.productView-description .tabs a[href^="#tab-dynamic-"]', function (e) {
        e.preventDefault();
        // Toggle .is-active on the clicked tab and corresponding .tab-content
    });
}
```
Single delegated listener so dynamically added tabs work without re-initializing Foundation.

**Entry point:**
```javascript
export default function initDynamicCustomFieldTabs(context) {
    if (!context?.productUseDynamicCustomFieldTabs || !context?.productCustomFields) return;
    const { leadingFields, tabs } = groupCustomFieldsIntoTabs(context.productCustomFields);
    injectLeadingCustomFields(leadingFields);
    if (tabs.length > 0) {
        injectDynamicTabs(tabs);
        bindDynamicTabClicks();
    }
}
```
Runs only when the custom template has set the flag and injected `productCustomFields`; then injects leading fields and, if any, dynamic tabs and click handler.

---

## 2. Modifications to Existing Files

### 2.1 Product page JS — call initializer

**File:** `assets/js/theme/product.js`

**Change 1 — Import:**
```javascript
import initDynamicCustomFieldTabs from './product/dynamic-custom-field-tabs';
```

**Change 2 — In `onReady`, before other product setup:**
```javascript
onReady() {
    // Dynamic __newtab custom field tabs (for prod-customFields-mod template)
    initDynamicCustomFieldTabs(this.context);
    // ... rest of onReady (modal, collapsible, ProductDetails, etc.)
}
```

**Explanation:** Every product page load runs the initializer. It no-ops unless the template has set `productUseDynamicCustomFieldTabs` and `productCustomFields`, so only prod-customFields-mod is affected.

---

### 2.2 Local dev layout mapping (optional)

**File:** `config.stencil.json`

**Relevant structure:**
```json
{
  "customLayouts": {
    "product": {
      "prod-customFields-mod.html": "/OHT-C10"
    }
  }
}
```

**Explanation:** For local Stencil, the product at path `/OHT-C10` uses the template `prod-customFields-mod.html`. Value must be the product path (e.g. `"/OHT-C10"`), not a full URL. Other products use the default product template unless assigned in the admin.

---

## 3. Summary Table

| Item | Type | Path / Location |
|------|------|------------------|
| Custom product template | New file | `templates/pages/custom/product/prod-customFields-mod.html` |
| Tabs component with anchors | New file | `templates/components/products/description-tabs-with-dynamic-fields.html` |
| Product view (no inline CF, anchors, custom tabs) | New file | `templates/components/products/product-view-custom-fields.html` |
| Dynamic tabs script | New file | `assets/js/theme/product/dynamic-custom-field-tabs.js` |
| Product page init | Modified | `assets/js/theme/product.js` (import + `initDynamicCustomFieldTabs(this.context)` in `onReady`) |
| Local layout mapping | Modified | `config.stencil.json` → `customLayouts.product` |

---

## 4. Data and DOM IDs

- **JS context:** `productUseDynamicCustomFieldTabs` (boolean), `productCustomFields` (array of `{ name, value }`).
- **Anchors:**  
  - `#product-leading-custom-fields-anchor` — product info `<dl>` (leading fields).  
  - `#product-dynamic-cf-tabs-anchor` — tab list (dynamic tab labels).  
  - `#product-dynamic-cf-content-anchor` — tab content container (dynamic panels).
- **Dynamic tab IDs:** `#tab-dynamic-{slug}-{index}` (e.g. `#tab-dynamic-documentation-0`).
