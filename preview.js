/**
 * Markdown → Rezeptseite (Vorschau + PDF via Drucken)
 */

const PREVIEW_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=DM+Sans:wght@400;500&display=swap");

:root {
  --bg: #f6f3ee;
  --paper: #fffdf9;
  --ink: #2b2a28;
  --muted: #6f6a63;
  --accent: #8b9a8d;
  --line: #ddd5c8;
}

@page { size: A4; margin: 18mm 16mm 20mm; }

* { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  font-family: "DM Sans", sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: var(--ink);
  background: var(--bg);
}

body.recipe-page { background: var(--paper); }

h1, h2, h3 {
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
  margin: 0;
  line-height: 1.15;
}

.page-wrap {
  max-width: 210mm;
  margin: 0 auto;
  padding: 1.5rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
}

.toolbar button {
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
}

.toolbar button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.recipe {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.75rem;
}

.recipe-header {
  border-bottom: 1px solid var(--line);
  padding-bottom: 1rem;
}

.recipe-header h1 {
  font-size: 2rem;
  margin-bottom: 0.35rem;
}

.recipe-description {
  color: var(--muted);
  margin: 0 0 0.75rem;
}

.recipe-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin: 0;
}

.recipe-meta div {
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
}

.recipe-meta dt {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.recipe-meta dd { margin: 0; font-weight: 500; }

.recipe-body {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

.ingredients h2, .steps h2, .recipe-notes h2 {
  font-size: 1.2rem;
  margin-bottom: 0.65rem;
}

.ingredients ul, .steps ol {
  margin: 0;
  padding-left: 1.1rem;
}

.ingredients li, .steps li {
  margin-bottom: 0.35rem;
  break-inside: avoid;
}

.recipe-notes {
  border-top: 1px solid var(--line);
  padding-top: 0.85rem;
}

.recipe-notes p { margin: 0; color: var(--muted); }

.recipe-source {
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0;
  word-break: break-all;
}

@media (max-width: 720px) {
  .recipe-body { grid-template-columns: 1fr; }
}

@media print {
  .no-print { display: none !important; }
  body { background: #fff; }
  .page-wrap { padding: 0; max-width: none; }
  .recipe { border: none; border-radius: 0; padding: 0; }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMarkdownToRecipe(markdown) {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new Error("Bitte zuerst Markdown in Schritt 3 erzeugen oder einfügen.");
  }

  const recipe = {
    title: "Unbenanntes Rezept",
    description: "",
    meta: {},
    ingredients: [],
    steps: [],
    notes: "",
    source: "",
  };

  let section = "";
  const lines = trimmed.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;

    if (line.startsWith("# ")) {
      recipe.title = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
      continue;
    }

    if (line.startsWith("Quelle:")) {
      recipe.source = line.replace(/^Quelle:\s*/i, "").trim();
      continue;
    }

    if (section === "rezeptinfo") {
      const match = line.match(/^-\s+\*\*(.+?):\*\*\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key.toLowerCase() === "beschreibung") {
          recipe.description = value;
        } else {
          recipe.meta[key] = value;
        }
      }
      continue;
    }

    if (section === "zutaten") {
      const match = line.match(/^-\s+(.+)$/);
      if (match && !line.startsWith("_")) {
        recipe.ingredients.push(match[1].trim());
      }
      continue;
    }

    if (section === "zubereitung") {
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      if (numbered) {
        recipe.steps.push(numbered[1].trim());
      }
    }
  }

  if (!recipe.ingredients.length && !recipe.steps.length && !recipe.title) {
    throw new Error("Markdown konnte nicht gelesen werden. Bitte Format aus Schritt 3 verwenden.");
  }

  return recipe;
}

function parseServingCount(text) {
  if (!text) return 1;
  const value = String(text).trim();
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 1;
  const parsed = parseFloat(match[1].replace(",", "."));
  return parsed > 0 ? parsed : 1;
}

function formatAmount(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
    return String(Math.round(rounded));
  }

  const fractions = [
    [0.25, "1/4"],
    [0.33, "1/3"],
    [0.5, "1/2"],
    [0.66, "2/3"],
    [0.75, "3/4"],
  ];

  const whole = Math.floor(rounded);
  const fraction = rounded - whole;

  for (const [amount, label] of fractions) {
    if (Math.abs(fraction - amount) < 0.06) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }

  return String(rounded).replace(".", ",");
}

function scaleIngredientAmount(line, factor) {
  if (!line || factor === 1) return line;

  const rangeMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s+(.*)$/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1].replace(",", ".")) * factor;
    const end = parseFloat(rangeMatch[2].replace(",", ".")) * factor;
    return `${formatAmount(start)}-${formatAmount(end)} ${rangeMatch[3]}`;
  }

  const fractionMatch = line.match(/^(\d+)\s*\/\s*(\d+)\s+(.*)$/);
  if (fractionMatch) {
    const amount = (Number(fractionMatch[1]) / Number(fractionMatch[2])) * factor;
    return `${formatAmount(amount)} ${fractionMatch[3]}`;
  }

  const numberMatch = line.match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);
  if (numberMatch) {
    const amount = parseFloat(numberMatch[1].replace(",", ".")) * factor;
    return `${formatAmount(amount)} ${numberMatch[2]}`;
  }

  return line;
}

function applyPortionScale(recipe, targetServings, baseServings = null) {
  const base = baseServings || parseServingCount(recipe.meta.Portionen);
  const safeBase = base > 0 ? base : 1;
  const safeTarget = targetServings > 0 ? targetServings : 1;
  const factor = safeTarget / safeBase;

  return {
    ...recipe,
    meta: {
      ...recipe.meta,
      Portionen: String(safeTarget),
    },
    ingredients: recipe.ingredients.map((item) => scaleIngredientAmount(item, factor)),
  };
}

function buildRecipeMarkup(recipe, options = {}) {
  const metaEntries = Object.entries(recipe.meta).filter(
    ([label]) => !(options.interactivePortions && label === "Portionen")
  );

  const metaItems = metaEntries
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )
    .join("");

  const portionControl = options.interactivePortions
    ? `<div class="portion-control">
        <dt>Portionen</dt>
        <dd>
          <div class="portion-stepper">
            <button type="button" class="portion-btn" data-portion-delta="-1" aria-label="Weniger Portionen">−</button>
            <input
              type="number"
              class="portion-input"
              min="1"
              max="99"
              step="1"
              value="${escapeHtml(String(options.currentServings || 1))}"
              aria-label="Portionen"
            >
            <button type="button" class="portion-btn" data-portion-delta="1" aria-label="Mehr Portionen">+</button>
          </div>
        </dd>
      </div>`
    : "";

  const ingredients = recipe.ingredients
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const steps = recipe.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  const description = recipe.description
    ? `<p class="recipe-description">${escapeHtml(recipe.description)}</p>`
    : "";

  const notes = recipe.notes
    ? `<footer class="recipe-notes"><h2>Tipp</h2><p>${escapeHtml(recipe.notes)}</p></footer>`
    : "";

  const source = recipe.source
    ? `<p class="recipe-source">Quelle: ${escapeHtml(recipe.source)}</p>`
    : "";

  return `
    <article class="recipe">
      <header class="recipe-header">
        <h1>${escapeHtml(recipe.title)}</h1>
        ${description}
        ${metaItems || portionControl ? `<dl class="recipe-meta">${metaItems}${portionControl}</dl>` : ""}
      </header>
      <div class="recipe-body">
        <section class="ingredients">
          <h2>Zutaten</h2>
          <ul>${ingredients || "<li><em>Keine Zutaten</em></li>"}</ul>
        </section>
        <section class="steps">
          <h2>Zubereitung</h2>
          <ol>${steps || "<li><em>Keine Schritte</em></li>"}</ol>
        </section>
      </div>
      ${notes}
      ${source}
    </article>
  `;
}

function buildPreviewHtml(recipe, options = {}) {
  const showToolbar = options.showToolbar !== false;
  const toolbar = showToolbar
    ? `<div class="toolbar no-print">
      <button type="button" class="primary" onclick="window.print()">Als PDF speichern / Drucken</button>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(recipe.title)}</title>
  <style>${PREVIEW_CSS}</style>
</head>
<body class="recipe-page">
  <div class="page-wrap">
    ${toolbar}
    ${buildRecipeMarkup(recipe)}
  </div>
</body>
</html>`;
}

function buildPreviewDocument(markdown, options = {}) {
  const recipe = parseMarkdownToRecipe(markdown);
  const html = buildPreviewHtml(recipe, options);
  return { recipe, html };
}

function renderPreviewInline(markdown, container, options = {}) {
  const recipe = parseMarkdownToRecipe(markdown);
  container.innerHTML = buildRecipeMarkup(recipe, options);
  return recipe;
}

function renderRecipeObject(container, recipe, options = {}) {
  container.innerHTML = buildRecipeMarkup(recipe, options);
  return recipe;
}

function openPreviewFromRecipe(recipe) {
  const html = buildPreviewHtml(recipe, { showToolbar: true });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (!tab) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blockiert. Bitte Pop-ups erlauben oder Vorschau im Frame nutzen.");
  }
  tab.addEventListener("load", () => URL.revokeObjectURL(url));
  return url;
}

function printPreviewFromRecipe(recipe) {
  const html = buildPreviewHtml(recipe, { showToolbar: false });
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
}

function openPreviewInNewTab(markdown) {
  const { html } = buildPreviewDocument(markdown, { showToolbar: true });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (!tab) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blockiert. Bitte Pop-ups erlauben oder Vorschau im Frame nutzen.");
  }
  tab.addEventListener("load", () => URL.revokeObjectURL(url));
  return url;
}

function renderPreviewInFrame(markdown, iframe) {
  const { html } = buildPreviewDocument(markdown);
  iframe.srcdoc = html;
}

function printPreviewFromMarkdown(markdown) {
  const { html } = buildPreviewDocument(markdown, { showToolbar: false });
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
}
