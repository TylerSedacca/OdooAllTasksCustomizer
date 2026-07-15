// ==UserScript==
// @name         Odoo All Tasks Customizer
// @namespace    tyler.odoo
// @version      2.5
// @description  Manual column widths, automatic group expansion on load, persistent custom group colors, cell-level color overrides, & group-specific color defaults
// @match        https://the-sign-brothers.odoo.com/odoo/all-tasks*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const WIDTH_STORAGE_KEY = "tyler-odoo-all-tasks-widths-v4";
    const COLOR_STORAGE_KEY = "tyler-odoo-all-tasks-colors-v1";
    const STYLE_ID = "tyler-odoo-customizer-style";
    const CONTROL_ID = "tyler-odoo-controls";
    const COLOR_PANEL_ID = "tyler-odoo-color-panel";

    /*
     * These are used only the first time the script runs.
     * After you drag a column, your chosen width is stored permanently.
     *
     * The order appears to be:
     * 0  Selection/icons
     * 1  Customer
     * 2  Project
     * 3  Task
     * 4  AM/PM
     * 5  Designer
     * 6  Status
     * 7  Priority
     * 8  Estimated Time
     * 9  Time Spent
     * 10 Time Remaining
     * 11 Submit Date
     * 12 Due Date
     */
    const INITIAL_WIDTHS = [
        80,
        300,
        300,
        270,
        160,
        150,
        130,
        110,
        120,
        120,
        135,
        105,
        105
    ];

    /*
     * Default colors for all groups & specific group overrides.
     * These are only used the first time a group is encountered.
     * Once customized, the color panel settings are saved permanently.
     */
    const DEFAULT_HEADER_COLOR = "#d1a91f";
    const DEFAULT_ITEM_COLOR = "#fff0b3";
    const DEFAULT_TEXT_COLOR = "#111111";

    const GROUP_DEFAULTS = {
        "SIGNATURE PROJECTS": { header: "#FFD766", item: "#FFFFFF", headerText: "#111111", itemText: "#111111" },
        "QUICK TURNS": { header: "#F6B26B", item: "#FFFFFF", headerText: "#111111", itemText: "#111111" },
        "PREFLIGHT": { header: "#0BA8DC", item: "#FFFFFF", headerText: "#111111", itemText: "#111111" },
        "MAIN DESIGN QUEUE": { header: "#93C47D", item: "#FFFFFF", headerText: "#111111", itemText: "#111111" }
    };

    /*
     * Cell-level overrides. If a cell's entire text matches one of these
     * keys (case-insensitive), that cell is recolored on top of the
     * group's row color. Add more entries here any time.
     */
    const CELL_TEXT_OVERRIDES = {
        // Priority overrides
        "CRITICAL": { background: "#8b0000", text: "#ffffff" },
        "HIGH": { background: "#ffb3b3", text: "#111111" },

        // Designer overrides
        "BRETT CARSON": { background: "#11306f", text: "#ffffff" },
        "JAMIE BOQUIST": { background: "#ff5b46", text: "#ffffff" },
        "CAROLINE FRANK": { background: "#b6fdfe", text: "#111111" },
        "LINDY VANG": { background: "#b089db", text: "#ffffff" },

        // Status overrides
        "IN PROGRESS": { background: "#b0dc51", text: "#111111" },
        "IN QUEUE": { background: "#fdbc64", text: "#111111" },
        "ON HOLD": { background: "#86b4ca", text: "#ffffff" },
        "NEEDS REVIEW": { background: "#e8697d", text: "#ffffff" },
        "STUCK": { background: "#ff7bd0", text: "#ffffff" },
        "FUTURE": { background: "#797e93", text: "#ffffff" },
        "PAUSED": { background: "#936fda", text: "#ffffff" }
    };

    let scheduled = false;
    let expansionTimer = null;
    let colorPanelOpen = false;

    /*
     * Fingerprint of the group list currently rendered inside the color
     * panel. The panel is only rebuilt when this changes, never while you
     * are interacting with it. This is what keeps the native color picker
     * from being closed underneath you.
     */
    let renderedGroupKey = null;

    /*
     * Track the last URL where groups were expanded.
     * Groups only expand on initial load/page navigation,
     * not on DOM mutations after that.
     */
    let lastUrlWhenExpanded = null;

    function isTargetPage() {
        return window.location.pathname.startsWith("/odoo/all-tasks");
    }

    function getTable() {
        return document.querySelector("table.o_list_table");
    }

    function getHeaderCells(table) {
        const headerRow =
            table.querySelector("thead tr:last-child") ||
            table.querySelector("thead tr");

        return headerRow ? Array.from(headerRow.children) : [];
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
            body.tyler-odoo-customized .o_list_renderer {
                overflow-x: auto !important;
                overflow-y: visible !important;
                text-align: left !important;
            }

            body.tyler-odoo-customized table.o_list_table {
                table-layout: fixed !important;
                display: table !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            }

            body.tyler-odoo-customized table.o_list_table th,
            body.tyler-odoo-customized table.o_list_table td {
                box-sizing: border-box !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            body.tyler-odoo-customized table.o_list_table thead th {
                position: relative !important;
            }

            body.tyler-odoo-customized .tyler-column-resizer {
                position: absolute;
                top: 0;
                right: -4px;
                width: 9px;
                height: 100%;
                cursor: col-resize;
                z-index: 100;
                user-select: none;
            }

            body.tyler-odoo-customized .tyler-column-resizer:hover {
                background: rgba(255, 255, 255, 0.30);
            }

            body.tyler-odoo-customized tr.tyler-group-row,
            body.tyler-odoo-customized tr.tyler-group-row > td,
            body.tyler-odoo-customized tr.tyler-group-row > th,
            body.tyler-odoo-customized tr.tyler-task-row,
            body.tyler-odoo-customized tr.tyler-task-row > td,
            body.tyler-odoo-customized tr.tyler-task-row > th {
                background-image: none !important;
                box-shadow: none !important;
            }

            body.tyler-odoo-customized tr.tyler-group-row > td,
            body.tyler-odoo-customized tr.tyler-group-row > th {
                font-weight: 700 !important;
            }

            body.tyler-odoo-customized tr.tyler-task-row:hover > td,
            body.tyler-odoo-customized tr.tyler-task-row:hover > th {
                filter: brightness(1.05);
            }

            #${CONTROL_ID} {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-left: 8px;
            }

            #${CONTROL_ID} button {
                font-size: 12px !important;
                line-height: 1.3 !important;
                padding: 4px 8px !important;
            }

            #${COLOR_PANEL_ID} {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 390px;
                max-height: calc(100vh - 110px);
                overflow-y: auto;
                z-index: 999999;
                padding: 14px;
                border: 1px solid #596273;
                border-radius: 7px;
                background: #252a36;
                color: #ffffff;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
                font-family: Arial, sans-serif;
            }

            #${COLOR_PANEL_ID} .tyler-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 12px;
            }

            #${COLOR_PANEL_ID} .tyler-panel-title {
                font-size: 15px;
                font-weight: 700;
            }

            #${COLOR_PANEL_ID} .tyler-close-button {
                border: 0;
                background: transparent;
                color: #ffffff;
                cursor: pointer;
                font-size: 19px;
                padding: 0 4px;
            }

            #${COLOR_PANEL_ID} .tyler-color-group {
                padding: 10px 0;
                border-top: 1px solid #424958;
            }

            #${COLOR_PANEL_ID} .tyler-color-group:first-of-type {
                border-top: 0;
            }

            #${COLOR_PANEL_ID} .tyler-group-name {
                margin-bottom: 8px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
            }

            #${COLOR_PANEL_ID} .tyler-color-controls {
                display: grid;
                grid-template-columns: 1fr 62px;
                align-items: center;
                gap: 7px 10px;
            }

            #${COLOR_PANEL_ID} label {
                font-size: 12px;
                color: #dfe3eb;
            }

            #${COLOR_PANEL_ID} input[type="color"] {
                width: 62px;
                height: 30px;
                padding: 1px;
                border: 1px solid #677084;
                border-radius: 4px;
                background: transparent;
                cursor: pointer;
            }

            #${COLOR_PANEL_ID} .tyler-panel-actions {
                display: flex;
                gap: 7px;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #424958;
            }

            #${COLOR_PANEL_ID} .tyler-panel-actions button {
                border: 1px solid #677084;
                border-radius: 4px;
                background: #343b49;
                color: #ffffff;
                padding: 6px 9px;
                cursor: pointer;
                font-size: 12px;
            }

            #${COLOR_PANEL_ID} .tyler-panel-actions button:hover {
                background: #424b5c;
            }
        `;

        document.head.appendChild(style);
    }

    function loadSavedWidths(columnCount) {
        let storedWidths = {};

        try {
            storedWidths = JSON.parse(
                localStorage.getItem(WIDTH_STORAGE_KEY) || "{}"
            );
        } catch {
            storedWidths = {};
        }

        return Array.from({ length: columnCount }, (_, index) => {
            const storedWidth = Number(storedWidths[index]);

            if (Number.isFinite(storedWidth) && storedWidth > 0) {
                return storedWidth;
            }

            return INITIAL_WIDTHS[index] || 100;
        });
    }

    function saveWidths(widths) {
        const storedWidths = {};

        widths.forEach((width, index) => {
            storedWidths[index] = Math.round(width);
        });

        localStorage.setItem(
            WIDTH_STORAGE_KEY,
            JSON.stringify(storedWidths)
        );
    }

    function ensureColgroup(table, columnCount) {
        let colgroup = table.querySelector("colgroup.tyler-colgroup");

        if (!colgroup) {
            colgroup = document.createElement("colgroup");
            colgroup.className = "tyler-colgroup";
            table.insertBefore(colgroup, table.firstChild);
        }

        while (colgroup.children.length < columnCount) {
            colgroup.appendChild(document.createElement("col"));
        }

        while (colgroup.children.length > columnCount) {
            colgroup.lastElementChild.remove();
        }

        return colgroup;
    }

    function applyWidths(table, widths) {
        const colgroup = ensureColgroup(table, widths.length);

        let exactTableWidth = 0;

        widths.forEach((width, index) => {
            const selectedWidth = Math.max(
                1,
                Math.round(Number(width) || 1)
            );

            const column = colgroup.children[index];

            column.style.removeProperty("min-width");
            column.style.removeProperty("max-width");

            column.style.setProperty(
                "width",
                `${selectedWidth}px`,
                "important"
            );

            exactTableWidth += selectedWidth;
        });

        table.style.removeProperty("min-width");
        table.style.removeProperty("max-width");

        table.style.setProperty(
            "width",
            `${exactTableWidth}px`,
            "important"
        );
    }

    function addColumnResizers(table) {
        const headers = getHeaderCells(table);

        if (!headers.length) {
            return;
        }

        let widths = loadSavedWidths(headers.length);

        applyWidths(table, widths);

        headers.forEach((header, index) => {
            if (header.querySelector(":scope > .tyler-column-resizer")) {
                return;
            }

            const resizer = document.createElement("div");
            resizer.className = "tyler-column-resizer";
            header.appendChild(resizer);

            resizer.addEventListener("mousedown", (event) => {
                event.preventDefault();
                event.stopPropagation();

                widths = loadSavedWidths(headers.length);

                const startingMouseX = event.clientX;
                const startingWidth = widths[index];

                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";

                function handleMouseMove(moveEvent) {
                    const selectedWidth =
                        startingWidth +
                        moveEvent.clientX -
                        startingMouseX;

                    widths[index] = Math.max(1, selectedWidth);

                    applyWidths(table, widths);
                }

                function handleMouseUp() {
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);

                    document.body.style.cursor = "";
                    document.body.style.userSelect = "";

                    saveWidths(widths);
                    applyWidths(table, widths);
                }

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
            });
        });
    }

    function normalizeGroupName(text) {
        return text
            .replace(/[▼▶▾▸►]/g, "")
            .replace(/\(\d+\)\s*$/, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function isGroupRow(row) {
        if (row.classList.contains("o_group_header")) {
            return true;
        }

        return Boolean(
            row.querySelector(
                ".o_group_name, .o_group_caret, " +
                ".fa-caret-right, .fa-caret-down, " +
                ".oi-chevron-right, .oi-chevron-down"
            )
        );
    }

    function getGroupName(row) {
        if (!isGroupRow(row)) {
            return null;
        }

        const preferredNameElement = row.querySelector(
            ".o_group_name, .o_group_header_name"
        );

        const text = preferredNameElement
            ? preferredNameElement.innerText
            : row.innerText;

        const normalized = normalizeGroupName(text);

        return normalized || null;
    }

    function getAllGroupNames(table) {
        const names = [];

        table.querySelectorAll("tbody tr").forEach((row) => {
            const groupName = getGroupName(row);

            if (groupName && !names.includes(groupName)) {
                names.push(groupName);
            }
        });

        return names;
    }

    /*
     * The color panel is built from the union of:
     *   1. groups currently visible in the table, and
     *   2. every group ever seen before (stored in local storage).
     */
    function getPanelGroupNames() {
        const names = [];

        const table = getTable();

        if (table) {
            getAllGroupNames(table).forEach((name) => {
                if (!names.includes(name)) {
                    names.push(name);
                }
            });
        }

        Object.keys(loadColorSettings()).forEach((name) => {
            if (!names.includes(name)) {
                names.push(name);
            }
        });

        return names;
    }

    function loadColorSettings() {
        try {
            return JSON.parse(
                localStorage.getItem(COLOR_STORAGE_KEY) || "{}"
            );
        } catch {
            return {};
        }
    }

    function saveColorSettings(settings) {
        localStorage.setItem(
            COLOR_STORAGE_KEY,
            JSON.stringify(settings)
        );
    }

    function getColorsForGroup(groupName) {
        const settings = loadColorSettings();

        if (!settings[groupName]) {
            // Use group-specific defaults if available, otherwise use generic defaults
            const groupDefault = GROUP_DEFAULTS[groupName] || {
                header: DEFAULT_HEADER_COLOR,
                item: DEFAULT_ITEM_COLOR,
                headerText: DEFAULT_TEXT_COLOR,
                itemText: DEFAULT_TEXT_COLOR
            };

            settings[groupName] = groupDefault;
            saveColorSettings(settings);
        }

        return settings[groupName];
    }

    function updateGroupColor(groupName, field, value) {
        const settings = loadColorSettings();

        if (!settings[groupName]) {
            // Use group-specific defaults if available, otherwise use generic defaults
            const groupDefault = GROUP_DEFAULTS[groupName] || {
                header: DEFAULT_HEADER_COLOR,
                item: DEFAULT_ITEM_COLOR,
                headerText: DEFAULT_TEXT_COLOR,
                itemText: DEFAULT_TEXT_COLOR
            };

            settings[groupName] = groupDefault;
        }

        settings[groupName][field] = value;
        saveColorSettings(settings);

        const table = getTable();

        if (table) {
            applyRowColors(table);
        }
    }

    const NESTED_COLOR_SELECTOR = "span, a, div, button, strong, i";

    function clearRowFormatting(row) {
        row.classList.remove("tyler-group-row", "tyler-task-row");

        row.style.removeProperty("background-color");
        row.style.removeProperty("color");

        Array.from(row.children).forEach((cell) => {
            cell.style.removeProperty("background-color");
            cell.style.removeProperty("background-image");
            cell.style.removeProperty("color");
        });

        row.querySelectorAll(NESTED_COLOR_SELECTOR).forEach((element) => {
            element.style.removeProperty("color");
        });
    }

    function applyCompleteRowColor(row, backgroundColor, textColor, className) {
        row.classList.add(className);

        row.style.setProperty("background-color", backgroundColor, "important");
        row.style.setProperty("color", textColor, "important");

        Array.from(row.children).forEach((cell) => {
            cell.style.setProperty("background-color", backgroundColor, "important");
            cell.style.setProperty("background-image", "none", "important");
            cell.style.setProperty("color", textColor, "important");
        });

        row.querySelectorAll(NESTED_COLOR_SELECTOR).forEach((element) => {
            element.style.setProperty("color", textColor, "important");
        });
    }

    /*
     * After the group's row color is applied, recolor any cell whose full
     * text is "Critical" or "High" (see CELL_TEXT_OVERRIDES above).
     */
    function applyCellOverrides(row) {
        Array.from(row.children).forEach((cell) => {
            const cellText = (cell.textContent || "")
                .replace(/\s+/g, " ")
                .trim()
                .toUpperCase();

            const override = CELL_TEXT_OVERRIDES[cellText];

            if (!override) {
                return;
            }

            cell.style.setProperty(
                "background-color",
                override.background,
                "important"
            );

            cell.style.setProperty(
                "background-image",
                "none",
                "important"
            );

            cell.style.setProperty(
                "color",
                override.text,
                "important"
            );

            cell.querySelectorAll(NESTED_COLOR_SELECTOR).forEach((element) => {
                element.style.setProperty(
                    "color",
                    override.text,
                    "important"
                );
            });
        });
    }

    function applyRowColors(table) {
        const rows = Array.from(table.querySelectorAll("tbody tr"));

        let activeGroupName = null;

        rows.forEach((row) => {
            clearRowFormatting(row);

            const groupName = getGroupName(row);

            if (groupName) {
                activeGroupName = groupName;

                const colors = getColorsForGroup(groupName);

                applyCompleteRowColor(
                    row,
                    colors.header,
                    colors.headerText,
                    "tyler-group-row"
                );

                return;
            }

            if (activeGroupName) {
                const colors = getColorsForGroup(activeGroupName);

                applyCompleteRowColor(
                    row,
                    colors.item,
                    colors.itemText,
                    "tyler-task-row"
                );

                applyCellOverrides(row);
            }
        });
    }

    function expandAllGroups(table) {
        const groupRows = Array.from(
            table.querySelectorAll("tbody tr")
        ).filter(isGroupRow);

        let expandedAny = false;

        groupRows.forEach((row) => {
            const collapsedControl =
                row.querySelector(".fa-caret-right") ||
                row.querySelector(".oi-chevron-right") ||
                row.querySelector('[aria-expanded="false"]');

            if (!collapsedControl || collapsedControl.offsetParent === null) {
                return;
            }

            const clickable =
                collapsedControl.closest("button") ||
                collapsedControl.closest("td") ||
                collapsedControl.closest("th") ||
                collapsedControl;

            clickable.click();
            expandedAny = true;
        });

        return expandedAny;
    }

    function createButton(text, clickHandler) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "btn btn-secondary btn-sm";
        button.textContent = text;
        button.addEventListener("click", clickHandler);

        return button;
    }

    function addControls() {
        if (document.getElementById(CONTROL_ID)) {
            return;
        }

        const toolbar =
            document.querySelector(".o_control_panel .o_cp_buttons") ||
            document.querySelector(".o_control_panel");

        if (!toolbar) {
            return;
        }

        const container = document.createElement("div");
        container.id = CONTROL_ID;

        const colorButton = createButton("Group Colors", toggleColorPanel);

        const resetWidthButton = createButton("Reset Widths", () => {
            localStorage.removeItem(WIDTH_STORAGE_KEY);
            window.location.reload();
        });

        container.appendChild(colorButton);
        container.appendChild(resetWidthButton);

        toolbar.appendChild(container);
    }

    function createColorInput(groupName, labelText, field, currentValue) {
        const label = document.createElement("label");
        label.textContent = labelText;

        const input = document.createElement("input");
        input.type = "color";
        input.value = currentValue;

        input.addEventListener("input", () => {
            updateGroupColor(groupName, field, input.value);
        });

        return { label, input };
    }

    function buildColorPanel() {
        const existingPanel = document.getElementById(COLOR_PANEL_ID);

        const previousScrollTop = existingPanel
            ? existingPanel.scrollTop
            : 0;

        existingPanel?.remove();

        const groupNames = getPanelGroupNames();

        renderedGroupKey = groupNames.join("|");

        const panel = document.createElement("div");
        panel.id = COLOR_PANEL_ID;

        const panelHeader = document.createElement("div");
        panelHeader.className = "tyler-panel-header";

        const panelTitle = document.createElement("div");
        panelTitle.className = "tyler-panel-title";
        panelTitle.textContent = "Group Row Colors";

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "tyler-close-button";
        closeButton.textContent = "×";

        closeButton.addEventListener("click", () => {
            panel.remove();
            colorPanelOpen = false;
            renderedGroupKey = null;
        });

        panelHeader.appendChild(panelTitle);
        panelHeader.appendChild(closeButton);
        panel.appendChild(panelHeader);

        groupNames.forEach((groupName) => {
            const colors = getColorsForGroup(groupName);

            const groupSection = document.createElement("div");
            groupSection.className = "tyler-color-group";

            const groupTitle = document.createElement("div");
            groupTitle.className = "tyler-group-name";
            groupTitle.textContent = groupName;

            const controls = document.createElement("div");
            controls.className = "tyler-color-controls";

            const inputs = [
                createColorInput(groupName, "Header background", "header", colors.header),
                createColorInput(groupName, "Task background", "item", colors.item),
                createColorInput(groupName, "Header text", "headerText", colors.headerText),
                createColorInput(groupName, "Task text", "itemText", colors.itemText)
            ];

            inputs.forEach(({ label, input }) => {
                controls.appendChild(label);
                controls.appendChild(input);
            });

            groupSection.appendChild(groupTitle);
            groupSection.appendChild(controls);
            panel.appendChild(groupSection);
        });

        const actions = document.createElement("div");
        actions.className = "tyler-panel-actions";

        const resetColorsButton = document.createElement("button");
        resetColorsButton.type = "button";
        resetColorsButton.textContent = "Reset All Colors";

        resetColorsButton.addEventListener("click", () => {
            const confirmed = window.confirm("Reset all saved group colors?");

            if (!confirmed) {
                return;
            }

            localStorage.removeItem(COLOR_STORAGE_KEY);

            const refreshedTable = getTable();

            if (refreshedTable) {
                applyRowColors(refreshedTable);
            }

            buildColorPanel();
        });

        actions.appendChild(resetColorsButton);
        panel.appendChild(actions);

        document.body.appendChild(panel);

        panel.scrollTop = previousScrollTop;
    }

    function toggleColorPanel() {
        const existingPanel = document.getElementById(COLOR_PANEL_ID);

        if (existingPanel) {
            existingPanel.remove();
            colorPanelOpen = false;
            renderedGroupKey = null;
            return;
        }

        colorPanelOpen = true;
        buildColorPanel();
    }

    /*
     * The panel is left alone unless the list of groups actually changed,
     * and it is never rebuilt while you are interacting with it.
     */
    function refreshOpenColorPanel() {
        if (!colorPanelOpen) {
            return;
        }

        const panel = document.getElementById(COLOR_PANEL_ID);

        if (panel && panel.contains(document.activeElement)) {
            return;
        }

        const currentKey = getPanelGroupNames().join("|");

        if (panel && currentKey === renderedGroupKey) {
            return;
        }

        buildColorPanel();
    }

    /*
     * When navigating away from All Tasks inside the Odoo single-page
     * application, remove every customization so other pages are
     * unaffected.
     */
    function deactivate() {
        if (!document.body) {
            return;
        }

        document.body.classList.remove("tyler-odoo-customized");

        document.getElementById(CONTROL_ID)?.remove();
        document.getElementById(COLOR_PANEL_ID)?.remove();

        colorPanelOpen = false;
        renderedGroupKey = null;
    }

    function customize() {
        if (!isTargetPage()) {
            deactivate();
            return;
        }

        const table = getTable();

        if (!table) {
            return;
        }

        document.body.classList.add("tyler-odoo-customized");

        injectStyles();
        addColumnResizers(table);
        applyRowColors(table);
        addControls();

        clearTimeout(expansionTimer);

        /*
         * Only expand groups if this is a new page/URL.
         * Once expanded for a URL, don't expand again even if the DOM updates.
         */
        const currentUrl = window.location.href;

        if (lastUrlWhenExpanded !== currentUrl) {
            expansionTimer = setTimeout(() => {
                const currentTable = getTable();

                if (!currentTable) {
                    return;
                }

                const didExpand = expandAllGroups(currentTable);

                // Only mark as expanded if we actually found and clicked something
                if (didExpand) {
                    lastUrlWhenExpanded = currentUrl;
                }

                setTimeout(() => {
                    const refreshedTable = getTable();

                    if (!refreshedTable) {
                        return;
                    }

                    const headers = getHeaderCells(refreshedTable);
                    const widths = loadSavedWidths(headers.length);

                    applyWidths(refreshedTable, widths);
                    addColumnResizers(refreshedTable);
                    applyRowColors(refreshedTable);
                    refreshOpenColorPanel();
                }, 300);
            }, 150);
        } else {
            // URL hasn't changed & expansion succeeded, just apply widths and colors
            const headers = getHeaderCells(table);
            const widths = loadSavedWidths(headers.length);

            applyWidths(table, widths);
            addColumnResizers(table);
            applyRowColors(table);
            refreshOpenColorPanel();
        }
    }

    function scheduleCustomization() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            customize();
        });
    }

    /*
     * Mutations caused by the script's own UI (the color panel and the
     * toolbar buttons) must not retrigger customization, otherwise the
     * panel would keep rebuilding itself in a loop.
     */
    function isOwnMutation(mutation) {
        const target = mutation.target;

        if (!(target instanceof Element)) {
            return false;
        }

        return Boolean(
            target.closest(`#${COLOR_PANEL_ID}`) ||
            target.closest(`#${CONTROL_ID}`)
        );
    }

    const observer = new MutationObserver((mutations) => {
        if (mutations.every(isOwnMutation)) {
            return;
        }

        scheduleCustomization();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    let previousUrl = window.location.href;

    window.setInterval(() => {
        if (window.location.href !== previousUrl) {
            previousUrl = window.location.href;
            lastUrlWhenExpanded = null; // Reset expansion flag on URL change
            scheduleCustomization();
        }
    }, 500);

    customize();
})();
