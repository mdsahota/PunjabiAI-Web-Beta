"use strict";

const SPEC_URL =
    "../../01-Keyboard/Layout-Specification/keyboard-layout-v2.json";

const EXPECTED_LAYER_COUNTS = {
    normal_layer: 46,
    shift_layer_approved: 46,
    altgr_layer_approved: 13,
};

const EXPECTED_DEAD_KEY_CARRIERS = 3;

const ALPHABET_KEYBOARD_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
    ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

const SYMBOL_KEYBOARD_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
];

const keyboardElement = document.querySelector("#keyboard");
const writingArea = document.querySelector("#writing-area");
const clearButton = document.querySelector("#clear-button");
const copyButton = document.querySelector("#copy-button");
let activeLayer = "normal_layer";
let keyboardMode = "alphabet";
let pendingDeadKey = null;


async function loadSpecification() {
    const response = await fetch(SPEC_URL);

    if (!response.ok) {
        throw new Error(
            `Specification request failed: ${response.status}`
        );
    }

    return response.json();
}


function validateSpecification(specification) {
    for (const [layerName, expectedCount] of Object.entries(
        EXPECTED_LAYER_COUNTS
    )) {
        const mappings = specification[layerName];

        if (
            mappings === null ||
            typeof mappings !== "object" ||
            Array.isArray(mappings)
        ) {
            throw new Error(
                `Missing or invalid mapping layer: ${layerName}`
            );
        }

        const actualCount = Object.keys(mappings).length;

        if (actualCount !== expectedCount) {
            throw new Error(
                `${layerName}: expected ${expectedCount} mappings; ` +
                `found ${actualCount}`
            );
        }
    }

    const deadKeys = specification.dead_keys;

    if (
        deadKeys === null ||
        typeof deadKeys !== "object" ||
        Array.isArray(deadKeys)
    ) {
        throw new Error("Missing or invalid dead_keys object");
    }

    const deadKeyCount = Object.keys(deadKeys).length;

    if (deadKeyCount !== EXPECTED_DEAD_KEY_CARRIERS) {
        throw new Error(
            `Expected ${EXPECTED_DEAD_KEY_CARRIERS} dead-key carriers; ` +
            `found ${deadKeyCount}`
        );
    }
}


function showStatus(message) {
    keyboardElement.replaceChildren();

    const statusMessage = document.createElement("p");
    statusMessage.textContent = message;

    keyboardElement.append(statusMessage);
}


function insertTextAtSelection(text) {
    const start = writingArea.selectionStart;
    const end = writingArea.selectionEnd;

    writingArea.setRangeText(text, start, end, "end");
    writingArea.focus();
}


async function handleCopy(copyButton) {
    const text = writingArea.value;

    if (text.length === 0) {
        writingArea.focus();
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        copyButton.textContent = "Copied";
        copyButton.disabled = true;

        window.setTimeout(() => {
            copyButton.textContent = "Copy";
            copyButton.disabled = false;
        }, 1200);
    } catch (error) {
        console.error("Unable to copy writing-area text.", error);
    }

    writingArea.focus();
}


function handleBackspace(specification) {
    if (pendingDeadKey !== null) {
        pendingDeadKey = null;
        renderKeyboard(specification);
        writingArea.focus();
        return;
    }

    const start = writingArea.selectionStart;
    const end = writingArea.selectionEnd;

    if (start !== end) {
        writingArea.setRangeText("", start, end, "end");
        writingArea.focus();
        return;
    }

    if (start === 0) {
        writingArea.focus();
        return;
    }

    const textBeforeCursor = writingArea.value.slice(0, start);
    const codePoints = Array.from(textBeforeCursor);
    const lastCodePoint = codePoints.pop();

    if (lastCodePoint === undefined) {
        writingArea.focus();
        return;
    }

    const deleteStart = start - lastCodePoint.length;

    writingArea.setRangeText("", deleteStart, start, "end");
    writingArea.focus();
}


function deadKeyPrefix(layerName) {
    const prefixes = {
        normal_layer: "normal",
        shift_layer_approved: "shift",
        altgr_layer_approved: "altgr",
    };

    return prefixes[layerName];
}


function deadKeyIdentifier(layerName, physicalKey) {
    return `${deadKeyPrefix(layerName)}:${physicalKey}`;
}


function handleKeyInput(
    specification,
    layerName,
    physicalKey,
    output
) {
    if (pendingDeadKey !== null) {
        const pendingDefinition =
            specification.dead_keys[pendingDeadKey];

        const composition =
            pendingDefinition.compositions[output];

        if (composition !== undefined) {
            insertTextAtSelection(composition);
        } else {
            insertTextAtSelection(
                pendingDefinition.carrier + output
            );
        }

        pendingDeadKey = null;
        renderKeyboard(specification);
        return;
    }

    const identifier = deadKeyIdentifier(layerName, physicalKey);
    const deadKeyDefinition = specification.dead_keys[identifier];

    if (deadKeyDefinition !== undefined) {
        pendingDeadKey = identifier;
        renderKeyboard(specification);
        writingArea.focus();
        return;
    }

    insertTextAtSelection(output);
}


function createKey(
    specification,
    layerName,
    physicalKey,
    output
) {
    const key = document.createElement("button");
    key.className = "keyboard-key";
    key.type = "button";

    const identifier = deadKeyIdentifier(layerName, physicalKey);
    const isDeadKey =
        specification.dead_keys[identifier] !== undefined;

    if (isDeadKey) {
        key.classList.add("dead-key");
        key.setAttribute("aria-pressed", pendingDeadKey === identifier);
    }

    const physicalLabel = document.createElement("span");
    physicalLabel.className = "physical-label";
    physicalLabel.textContent = physicalKey;

    const outputLabel = document.createElement("span");
    outputLabel.className = "output-label";
    outputLabel.textContent = output;

    key.append(physicalLabel, outputLabel);

    key.addEventListener("click", () => {
        handleKeyInput(
            specification,
            layerName,
            physicalKey,
            output
        );
    });

    return key;
}


function keyboardRowsForMode() {
    if (keyboardMode === "symbols") {
        return SYMBOL_KEYBOARD_ROWS;
    }

    return ALPHABET_KEYBOARD_ROWS;
}


function createModeButton(specification) {
    const button = document.createElement("button");
    button.className = "keyboard-key action-key mode-key";
    button.type = "button";

    if (keyboardMode === "alphabet") {
        button.textContent = "123";
        button.setAttribute(
            "aria-label",
            "Show numbers and symbols"
        );
    } else {
        button.textContent = "ABC";
        button.setAttribute(
            "aria-label",
            "Show Punjabi alphabet keyboard"
        );
    }

    button.addEventListener("click", () => {
        if (keyboardMode === "alphabet") {
            keyboardMode = "symbols";
        } else {
            keyboardMode = "alphabet";
            activeLayer = "normal_layer";
        }

        renderKeyboard(specification);
        writingArea.focus();
    });

    return button;
}


function renderKeyboard(specification) {
    const mappings = specification[activeLayer];

    keyboardElement.replaceChildren();

    if (pendingDeadKey !== null) {
        const status = document.createElement("p");
        status.className = "keyboard-status";
        status.textContent =
            "Dead key active: choose the next key";

        keyboardElement.append(status);
    }

    const keyboardRows = document.createElement("div");
    keyboardRows.className = "keyboard-rows";

    for (const rowKeys of keyboardRowsForMode()) {
        const row = document.createElement("div");
        row.className = "keyboard-row";

        for (const physicalKey of rowKeys) {
            const output = mappings[physicalKey];

            if (output === undefined) {
                const key = document.createElement("button");
                key.className = "keyboard-key unmapped-key";
                key.type = "button";
                key.disabled = true;

                const physicalLabel = document.createElement("span");
                physicalLabel.className = "physical-label";
                physicalLabel.textContent = physicalKey;

                const outputLabel = document.createElement("span");
                outputLabel.className = "output-label";
                outputLabel.textContent = "?";

                key.append(physicalLabel, outputLabel);
                row.append(key);
                continue;
            }

            row.append(
                createKey(
                    specification,
                    activeLayer,
                    physicalKey,
                    output
                )
            );
        }

        keyboardRows.append(row);
    }

    const spaceRow = document.createElement("div");
    spaceRow.className = "keyboard-row keyboard-action-row";

    const modeButton = createModeButton(specification);

    const backspaceKey = document.createElement("button");
    backspaceKey.className = "keyboard-key action-key";
    backspaceKey.type = "button";
    backspaceKey.textContent = "\u232B";
    backspaceKey.setAttribute("aria-label", "Backspace");
    backspaceKey.title = "Backspace";

    backspaceKey.addEventListener("click", () => {
        handleBackspace(specification);
    });

    const altGrButton = createLayerButton(
        specification,
        "altgr_layer_approved",
        "AltGr"
    );

    const shiftButton = document.createElement("button");
    shiftButton.className = "layer-button shift-key";
    shiftButton.type = "button";
    shiftButton.textContent = "\u21E7";
    shiftButton.setAttribute("aria-label", "Toggle Shift");

    shiftButton.classList.toggle(
        "active",
        activeLayer === "shift_layer_approved"
    );

    shiftButton.addEventListener("click", () => {
        const nextLayer =
            activeLayer === "shift_layer_approved"
                ? "normal_layer"
                : "shift_layer_approved";

        selectLayer(specification, nextLayer);
    });

    const spaceKey = document.createElement("button");
    spaceKey.className = "keyboard-key space-key";
    spaceKey.type = "button";

    const spaceLabel = document.createElement("span");
    spaceLabel.textContent = "Space";

    spaceKey.append(spaceLabel);

    spaceKey.addEventListener("click", () => {
        handleKeyInput(
            specification,
            activeLayer,
            " ",
            " "
        );
    });

    const enterKey = document.createElement("button");
    enterKey.className = "keyboard-key action-key enter-key";
    enterKey.type = "button";
    enterKey.textContent = "\u21B5";
    enterKey.setAttribute("aria-label", "Enter");

    enterKey.addEventListener("click", () => {
        handleKeyInput(
            specification,
            activeLayer,
            "Enter",
            "\n"
        );
    });

    spaceRow.append(
        modeButton,
        altGrButton,
        shiftButton,
        spaceKey,
        enterKey,
        backspaceKey
    );

    keyboardRows.append(spaceRow);

    keyboardElement.append(keyboardRows);
}


function createLayerButton(
    specification,
    layerName,
    label
) {
    const button = document.createElement("button");
    button.className = "layer-button";
    button.type = "button";
    button.dataset.layer = layerName;
    button.textContent = label;

    button.classList.toggle(
        "active",
        layerName === activeLayer
    );

    button.addEventListener("click", () => {
        selectLayer(specification, layerName);
    });

    return button;
}


function selectLayer(specification, layerName) {
    activeLayer = layerName;

    renderKeyboard(specification);
    writingArea.focus();
}


function handleClear() {
    writingArea.value = "";
    pendingDeadKey = null;
    writingArea.focus();
}


function handlePhysicalKeyboardInput(
    specification,
    event
) {
    if (event.target !== writingArea) {
        return;
    }

    const isAltGr =
        event.getModifierState("AltGraph") ||
        (event.ctrlKey && event.altKey && !event.metaKey);

    if (
        !isAltGr &&
        (event.ctrlKey || event.altKey || event.metaKey)
    ) {
        return;
    }

    if (event.key === "Backspace") {
        event.preventDefault();
        handleBackspace(specification);
        return;
    }

    if (event.key === " ") {
        event.preventDefault();

        handleKeyInput(
            specification,
            "normal_layer",
            " ",
            " "
        );

        return;
    }

    if (event.key === "Enter") {
        event.preventDefault();

        handleKeyInput(
            specification,
            "normal_layer",
            "Enter",
            "\n"
        );

        return;
    }

    if (event.key.length !== 1) {
        return;
    }

    const physicalKey = event.key.toLowerCase();

    let layerName = "normal_layer";

    if (isAltGr) {
        layerName = "altgr_layer_approved";
    } else if (event.shiftKey) {
        layerName = "shift_layer_approved";
    }

    const mappings = specification[layerName];
    const output = mappings[physicalKey];

    if (output === undefined) {
        return;
    }

    event.preventDefault();

    handleKeyInput(
        specification,
        layerName,
        physicalKey,
        output
    );
}


function initializeEditorActions() {
    clearButton.disabled = false;
    copyButton.disabled = false;

    clearButton.addEventListener("click", () => {
        handleClear();
    });

    copyButton.addEventListener("click", () => {
        handleCopy(copyButton);
    });
}


async function main() {
    showStatus("Loading PunjabiAI keyboard specification...");

    try {
        const specification = await loadSpecification();

        validateSpecification(specification);

        initializeEditorActions();

        writingArea.addEventListener("keydown", (event) => {
            handlePhysicalKeyboardInput(specification, event);
        });

        renderKeyboard(specification);
        writingArea.focus();
    } catch (error) {
        showStatus(
            `Unable to load PunjabiAI keyboard specification: ` +
            `${error.message}`
        );

        console.error(error);
    }
}


main();
