/**
 * Builds dynamic product tabs from custom fields using __newtab trigger.
 * When custom field name is __newtab, its value becomes a new tab label;
 * following custom fields (until next __newtab or end) are shown in that tab.
 * Trigger entries are never displayed as content.
 */

const NEWTAB_TRIGGER_NAME = '__newtab';

/** Normalize custom field name for trigger check (case-insensitive). */
function isNewTabTrigger(name) {
    return name && String(name).trim().toLowerCase() === NEWTAB_TRIGGER_NAME;
}

/**
 * Create a URL-safe slug from a tab label for use in element ids.
 * @param {string} label - Tab label (e.g. "Documentation")
 * @param {number} index - Optional index to ensure uniqueness
 * @returns {string}
 */
function slugify(label, index = 0) {
    if (typeof label !== 'string') return `tab-custom-${index}`;
    const slug = label
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    return slug || `tab-custom-${index}`;
}

/**
 * Split custom fields into leading fields (before first __newtab) and tabs (from first __newtab onward).
 * @param {Array<{name: string, value: string}>} customFields
 * @returns {{ leadingFields: Array<{name: string, value: string}>, tabs: Array<{label: string, slug: string, fields: Array<{name: string, value: string}>}> }}
 */
export function groupCustomFieldsIntoTabs(customFields) {
    const result = { leadingFields: [], tabs: [] };
    if (!Array.isArray(customFields) || customFields.length === 0) {
        return result;
    }

    const tabs = [];
    let currentTab = null;
    let seenFirstTrigger = false;

    customFields.forEach((field) => {
        const name = field.name && String(field.name).trim();
        const value = field.value != null ? field.value : '';

        if (isNewTabTrigger(name)) {
            seenFirstTrigger = true;
            const label = typeof value === 'string' ? value.trim() : String(value);
            currentTab = {
                label: label || 'Details',
                slug: slugify(label, tabs.length),
                fields: [],
            };
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

/**
 * Escape HTML for safe display in text content (not for raw HTML values).
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Inject leading custom fields (before first __newtab) into the product info dl.
 * @param {Array<{name: string, value: string}>} leadingFields
 */
function injectLeadingCustomFields(leadingFields) {
    if (!leadingFields || leadingFields.length === 0) return;

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

/**
 * Build tab list items and tab content panels HTML and inject into the product page.
 * @param {Array<{label: string, slug: string, fields: Array<{name: string, value: string}>}>} tabs
 */
function injectDynamicTabs(tabs) {
    if (!tabs || tabs.length === 0) return;

    const $listAnchor = $('#product-dynamic-cf-tabs-anchor');
    const $contentAnchor = $('#product-dynamic-cf-content-anchor');

    if ($listAnchor.length === 0 || $contentAnchor.length === 0) return;

    const tabListFrag = document.createDocumentFragment();
    const contentFrag = document.createDocumentFragment();

    tabs.forEach((tab, i) => {
        const id = `tab-dynamic-${tab.slug}-${i}`;

        const li = document.createElement('li');
        li.className = 'tab';
        li.innerHTML = `<a class="tab-title" href="#${id}">${escapeHtml(tab.label)}</a>`;
        tabListFrag.appendChild(li);

        const div = document.createElement('div');
        div.className = 'tab-content';
        div.id = id;
        const dl = document.createElement('dl');
        dl.className = 'productView-info';
        tab.fields.forEach((field) => {
            const dt = document.createElement('dt');
            dt.className = 'productView-info-name';
            dt.textContent = `${field.name}:`;
            const dd = document.createElement('dd');
            dd.className = 'productView-info-value';
            dd.innerHTML = field.value;
            dl.appendChild(dt);
            dl.appendChild(dd);
        });
        div.appendChild(dl);
        contentFrag.appendChild(div);
    });

    $listAnchor.before(tabListFrag);
    $contentAnchor.before(contentFrag);
}

/**
 * Bind click handler for dynamically injected tab links (Foundation may not attach to them).
 */
function bindDynamicTabClicks() {
    $(document).on('click', '.productView-description .tabs a[href^="#tab-dynamic-"]', function (e) {
        const href = $(this).attr('href');
        if (!href || href === '#') return;
        const $content = $(href);
        if ($content.length === 0) return;
        e.preventDefault();
        const $tabs = $(this).closest('.tabs');
        const $contents = $content.parent().children('.tab-content');
        $tabs.find('.tab').removeClass('is-active');
        $(this).closest('.tab').addClass('is-active');
        $contents.removeClass('is-active');
        $content.addClass('is-active');
    });
}

/**
 * Initialize dynamic custom field tabs when context indicates this template uses them.
 * Leading custom fields (before first __newtab) are shown in the product info area;
 * from first __newtab onward, fields are shown in dynamic tabs.
 * @param {Object} context - Stencil JS context (must have productUseDynamicCustomFieldTabs and productCustomFields)
 */
export default function initDynamicCustomFieldTabs(context) {
    if (!context || !context.productUseDynamicCustomFieldTabs || !context.productCustomFields) {
        return;
    }

    const { leadingFields, tabs } = groupCustomFieldsIntoTabs(context.productCustomFields);

    injectLeadingCustomFields(leadingFields);

    if (tabs.length > 0) {
        injectDynamicTabs(tabs);
        bindDynamicTabClicks();
    }
}
