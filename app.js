/**
 * JSON-LD Rezept → Markdown
 * Findet Recipe-Objekte in verschachteltem JSON und formatiert sie lesbar.
 */

function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Bitte zuerst den kopierten JSON-Text einfügen.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Manchmal kopiert man nur den inneren Block ohne äußere Klammern
    try {
      return JSON.parse(`{${trimmed}}`);
    } catch {
      throw new Error(
        "Der Text ist kein gültiges JSON. Bitte den kompletten Recipe-Block kopieren (mit { … })."
      );
    }
  }
}

function isRecipe(node) {
  if (!node || typeof node !== "object") return false;
  const type = node["@type"];
  if (type === "Recipe") return true;
  if (Array.isArray(type) && type.includes("Recipe")) return true;
  return false;
}

function findRecipes(node, found = []) {
  if (!node) return found;

  if (Array.isArray(node)) {
    node.forEach((item) => findRecipes(item, found));
    return found;
  }

  if (typeof node === "object") {
    if (isRecipe(node)) found.push(node);
    Object.values(node).forEach((value) => findRecipes(value, found));
  }

  return found;
}

function parseDuration(iso) {
  if (!iso || typeof iso !== "string") return null;

  const match = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return iso;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);

  const parts = [];
  if (days) parts.push(`${days} Tag${days > 1 ? "e" : ""}`);
  if (hours) parts.push(`${hours} Std`);
  if (minutes) parts.push(`${minutes} Min`);

  return parts.length ? parts.join(" ") : iso;
}

function asText(value) {
  if (value == null) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return (
      value.text ||
      value.name ||
      value.description ||
      value["@value"] ||
      null
    );
  }
  return String(value);
}

function normalizeYield(recipe) {
  const y = recipe.recipeYield ?? recipe.yield;
  if (!y) return null;
  if (Array.isArray(y)) return y.map(asText).filter(Boolean).join(", ");
  return asText(y);
}

function normalizeIngredients(recipe) {
  const raw = recipe.recipeIngredient || recipe.ingredients || [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(asText).filter(Boolean);
}

function extractStepsFromNode(node) {
  if (!node) return [];

  if (typeof node === "string") return [node.trim()].filter(Boolean);

  if (Array.isArray(node)) {
    return node.flatMap(extractStepsFromNode);
  }

  if (typeof node === "object") {
    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];

    if (types.includes("HowToSection")) {
      const sectionName = asText(node.name);
      const inner = extractStepsFromNode(node.itemListElement || node.hasPart || []);
      if (sectionName && inner.length) {
        return [`**${sectionName}**`, ...inner];
      }
      return inner;
    }

    if (types.includes("HowToStep") || node.text || node.name) {
      const text = asText(node.text) || asText(node.name);
      return text ? [text] : [];
    }

    if (node.itemListElement) {
      return extractStepsFromNode(node.itemListElement);
    }

    if (node.description) {
      const text = asText(node.description);
      return text ? [text] : [];
    }
  }

  return [];
}

function normalizeInstructions(recipe) {
  const raw = recipe.recipeInstructions || recipe.instructions;
  if (!raw) return [];

  if (typeof raw === "string") {
    return raw
      .split(/\n+|\.\s+(?=[A-ZÄÖÜ])/)
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter(Boolean);
  }

  return extractStepsFromNode(raw);
}

function recipeToMarkdown(recipe) {
  const title = asText(recipe.name) || "Unbenanntes Rezept";
  const lines = [`# ${title}`, "", "## Rezeptinfo", ""];

  const info = [
    ["Portionen", normalizeYield(recipe)],
    ["Vorbereitung", parseDuration(recipe.prepTime)],
    ["Koch-/Backzeit", parseDuration(recipe.cookTime)],
    ["Gesamtzeit", parseDuration(recipe.totalTime)],
    ["Schwierigkeit", asText(recipe.recipeCategory) || null],
  ];

  info.forEach(([label, value]) => {
    if (value) lines.push(`- **${label}:** ${value}`);
  });

  if (asText(recipe.description)) {
    lines.push(`- **Beschreibung:** ${asText(recipe.description)}`);
  }

  lines.push("", "## Zutaten", "");
  const ingredients = normalizeIngredients(recipe);
  if (ingredients.length) {
    ingredients.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("_Keine Zutaten gefunden – bitte manuell ergänzen._");
  }

  lines.push("", "## Zubereitung", "");
  const steps = normalizeInstructions(recipe);
  if (steps.length) {
    steps.forEach((step, index) => {
      if (step.startsWith("**")) {
        lines.push("", step);
      } else {
        lines.push(`${index + 1}. ${step}`);
      }
    });
  } else {
    lines.push("_Keine Schritte gefunden – bitte manuell ergänzen._");
  }

  const source = asText(recipe.url) || asText(recipe.mainEntityOfPage);
  if (source) {
    lines.push("", "---", `Quelle: ${source}`);
  }

  return lines.join("\n");
}

function convertRecipeJsonToMarkdown(raw) {
  const data = parseInput(raw);
  const recipes = findRecipes(data);

  if (!recipes.length) {
    throw new Error(
      'Kein Rezept gefunden. Suche im JSON nach "@type": "Recipe" und kopiere genau diesen Block.'
    );
  }

  if (recipes.length > 1) {
    return recipes.map(recipeToMarkdown).join("\n\n---\n\n");
  }

  return recipeToMarkdown(recipes[0]);
}

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Bitte eine Rezept-URL eingeben.");
  }

  const urlString = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(urlString).toString();
  } catch {
    throw new Error("Die URL sieht ungültig aus. Bitte prüfen.");
  }
}

function extractJsonLdFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [];

  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    const text = script.textContent.trim();
    if (!text) return;

    try {
      blocks.push(JSON.parse(text));
    } catch {
      // Ungültige Blöcke überspringen
    }
  });

  return blocks;
}

async function fetchHtml(url) {
  const attempts = [
    () => fetch(url, { mode: "cors", headers: { Accept: "text/html" } }),
    () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`),
    () => fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`),
  ];

  let lastStatus = "";

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      if (!response.ok) {
        lastStatus = `HTTP ${response.status}`;
        continue;
      }

      const html = await response.text();
      if (html && html.length > 200) {
        return html;
      }
    } catch (err) {
      lastStatus = err.message || "Netzwerkfehler";
    }
  }

  throw new Error(
    `Seite konnte nicht geladen werden (${lastStatus || "kein Zugriff"}). Bitte manuelle Methode in Schritt 1 verwenden.`
  );
}

function pickRecipeFromBlocks(blocks) {
  const recipes = [];
  blocks.forEach((block) => findRecipes(block, recipes));

  if (!recipes.length) {
    throw new Error(
      "Auf der Seite wurde kein Recipe-JSON gefunden. Bitte manuelle Methode in Schritt 1 verwenden."
    );
  }

  return recipes[0];
}

async function fetchRecipeFromUrl(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const html = await fetchHtml(url);
  const blocks = extractJsonLdFromHtml(html);

  if (!blocks.length) {
    throw new Error(
      "Kein JSON-LD auf der Seite gefunden. Bitte manuelle Methode in Schritt 1 verwenden."
    );
  }

  const recipe = pickRecipeFromBlocks(blocks);
  if (!recipe.url) {
    recipe.url = url;
  }

  return recipe;
}

async function copyText(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Kopiert!";
    setTimeout(() => {
      button.textContent = original;
    }, 1800);
  } catch {
    button.textContent = "Kopieren fehlgeschlagen";
  }
}

const CONSOLE_CMD = `[...document.querySelectorAll('script[type="application/ld+json"]')]
  .map(s => s.textContent)
  .map(t => { try { return JSON.parse(t) } catch { return t } })`;

document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("url-input");
  const fetchUrlBtn = document.getElementById("fetch-url-btn");
  const urlStatus = document.getElementById("url-status");
  const input = document.getElementById("json-input");
  const output = document.getElementById("markdown-output");
  const status = document.getElementById("status");
  const convertBtn = document.getElementById("convert-btn");
  const copyCmdBtn = document.getElementById("copy-cmd-btn");
  const copyMdBtn = document.getElementById("copy-md-btn");
  const clearBtn = document.getElementById("clear-btn");
  const previewFrame = document.getElementById("preview-frame");
  const previewUpdateBtn = document.getElementById("preview-update-btn");
  const previewTabBtn = document.getElementById("preview-tab-btn");
  const previewPdfBtn = document.getElementById("preview-pdf-btn");
  const previewStatus = document.getElementById("preview-status");

  copyCmdBtn.addEventListener("click", () => copyText(CONSOLE_CMD, copyCmdBtn));

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function setUrlStatus(message, type = "") {
    urlStatus.textContent = message;
    urlStatus.className = `status ${type}`.trim();
  }

  function setPreviewStatus(message, type = "") {
    previewStatus.textContent = message;
    previewStatus.className = `status ${type}`.trim();
  }

  function updatePreview() {
    try {
      renderPreviewInFrame(output.value, previewFrame);
      setPreviewStatus("Rezeptseite aktualisiert.", "ok");
    } catch (err) {
      previewFrame.srcdoc = "";
      setPreviewStatus(err.message || "Vorschau fehlgeschlagen.", "error");
    }
  }

  function runConvert() {
    try {
      const markdown = convertRecipeJsonToMarkdown(input.value);
      output.value = markdown;
      setStatus("Markdown wurde erstellt. Du kannst es kopieren oder in Word einfügen.", "ok");
      updatePreview();
    } catch (err) {
      output.value = "";
      setStatus(err.message || "Unbekannter Fehler.", "error");
      previewFrame.srcdoc = "";
      setPreviewStatus("");
    }
  }

  async function loadRecipeFromUrl() {
    setUrlStatus("");
    setStatus("");

    try {
      fetchUrlBtn.disabled = true;
      fetchUrlBtn.textContent = "Lädt …";
      setUrlStatus("Rezeptseite wird geladen …");

      const recipe = await fetchRecipeFromUrl(urlInput.value);
      input.value = JSON.stringify(recipe, null, 2);
      runConvert();

      const title = asText(recipe.name) || "Rezept";
      setUrlStatus(`„${title}" gefunden und Markdown erstellt.`, "ok");
    } catch (err) {
      input.value = "";
      output.value = "";
      setUrlStatus(err.message || "Unbekannter Fehler.", "error");
    } finally {
      fetchUrlBtn.disabled = false;
      fetchUrlBtn.textContent = "Rezept laden";
    }
  }

  fetchUrlBtn.addEventListener("click", loadRecipeFromUrl);

  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadRecipeFromUrl();
    }
  });

  convertBtn.addEventListener("click", runConvert);

  input.addEventListener("input", () => {
    if (input.value.trim()) runConvert();
    else {
      output.value = "";
      setStatus("");
      previewFrame.srcdoc = "";
      setPreviewStatus("");
    }
  });

  output.addEventListener("input", updatePreview);

  previewUpdateBtn.addEventListener("click", updatePreview);

  previewTabBtn.addEventListener("click", () => {
    try {
      openPreviewInNewTab(output.value);
      setPreviewStatus("Rezeptseite in neuem Tab geöffnet.", "ok");
    } catch (err) {
      setPreviewStatus(err.message || "Tab konnte nicht geöffnet werden.", "error");
    }
  });

  previewPdfBtn.addEventListener("click", () => {
    try {
      printPreviewFromMarkdown(output.value);
      setPreviewStatus("Druckdialog geöffnet – „Als PDF sichern“ wählen.", "ok");
    } catch (err) {
      setPreviewStatus(err.message || "PDF-Export fehlgeschlagen.", "error");
    }
  });

  copyMdBtn.addEventListener("click", () => {
    if (!output.value.trim()) {
      setStatus("Zuerst Markdown erzeugen.", "error");
      return;
    }
    copyText(output.value, copyMdBtn);
  });

  clearBtn.addEventListener("click", () => {
    urlInput.value = "";
    input.value = "";
    output.value = "";
    previewFrame.srcdoc = "";
    setStatus("");
    setUrlStatus("");
    setPreviewStatus("");
    urlInput.focus();
  });
});
