document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("url-input");
  const fetchUrlBtn = document.getElementById("fetch-url-btn");
  const urlStatus = document.getElementById("url-status");
  const urlLoading = document.getElementById("url-loading");
  const fallbackDetails = document.getElementById("fallback-details");
  const input = document.getElementById("json-input");
  const output = document.getElementById("markdown-output");
  const status = document.getElementById("status");
  const convertBtn = document.getElementById("convert-btn");
  const copyCmdBtn = document.getElementById("copy-cmd-btn");
  const copyMdBtn = document.getElementById("copy-md-btn");
  const clearBtn = document.getElementById("clear-btn");
  const recipePreview = document.getElementById("recipe-preview");
  const previewLoading = document.getElementById("preview-loading");
  const previewEmpty = document.getElementById("preview-empty");
  const previewUpdateBtn = document.getElementById("preview-update-btn");
  const previewTabBtn = document.getElementById("preview-tab-btn");
  const previewPdfBtn = document.getElementById("preview-pdf-btn");
  const previewStatus = document.getElementById("preview-status");

  let baseRecipe = null;
  let baseServings = 1;
  let currentServings = 1;

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

  function showUrlLoading() {
    urlLoading.classList.remove("is-hidden");
    urlLoading.setAttribute("aria-hidden", "false");
  }

  function hideUrlLoading() {
    urlLoading.classList.add("is-hidden");
    urlLoading.setAttribute("aria-hidden", "true");
  }

  function showPreviewLoading() {
    previewLoading.classList.remove("is-hidden");
    previewLoading.setAttribute("aria-hidden", "false");
    recipePreview.classList.add("is-hidden");
    previewEmpty.classList.add("is-hidden");
  }

  function hidePreviewLoading() {
    previewLoading.classList.add("is-hidden");
    previewLoading.setAttribute("aria-hidden", "true");
  }

  function showPreview() {
    hidePreviewLoading();
    recipePreview.classList.remove("is-hidden");
    previewEmpty.classList.add("is-hidden");
  }

  function hidePreview() {
    hidePreviewLoading();
    recipePreview.classList.add("is-hidden");
    recipePreview.innerHTML = "";
    previewEmpty.classList.remove("is-hidden");
    baseRecipe = null;
  }

  function getDisplayRecipe() {
    if (!baseRecipe) {
      throw new Error("Noch kein Rezept geladen.");
    }
    return applyPortionScale(baseRecipe, currentServings, baseServings);
  }

  function loadBaseRecipeFromMarkdown() {
    baseRecipe = parseMarkdownToRecipe(output.value);
    baseServings = parseServingCount(baseRecipe.meta.Portionen);
    currentServings = baseServings;
  }

  function renderCurrentRecipe() {
    const displayRecipe = getDisplayRecipe();
    renderRecipeObject(recipePreview, displayRecipe, {
      interactivePortions: true,
      currentServings,
    });
    showPreview();
  }

  function setPortions(nextValue) {
    const parsed = Math.max(1, Math.min(99, Number(nextValue) || 1));
    currentServings = parsed;
    renderCurrentRecipe();
  }

  function openFallback() {
    fallbackDetails.open = true;
    fallbackDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updatePreview() {
    try {
      loadBaseRecipeFromMarkdown();
      renderCurrentRecipe();
      setPreviewStatus("Rezeptansicht aktualisiert.", "ok");
    } catch (err) {
      hidePreview();
      setPreviewStatus(err.message || "Vorschau fehlgeschlagen.", "error");
    }
  }

  function runConvert() {
    try {
      const markdown = convertRecipeJsonToMarkdown(input.value);
      output.value = markdown;
      setStatus("Rezept erstellt.", "ok");
      updatePreview();
    } catch (err) {
      output.value = "";
      setStatus(err.message || "Unbekannter Fehler.", "error");
      hidePreview();
      setPreviewStatus("");
    }
  }

  async function loadRecipeFromUrl() {
    setUrlStatus("");
    setStatus("");
    setPreviewStatus("");
    showUrlLoading();
    showPreviewLoading();

    try {
      fetchUrlBtn.disabled = true;
      fetchUrlBtn.textContent = "Lädt …";

      const recipe = await fetchRecipeFromUrl(urlInput.value);
      input.value = JSON.stringify(recipe, null, 2);
      runConvert();

      const title = asText(recipe.name) || "Rezept";
      setUrlStatus(`„${title}" geladen.`, "ok");
    } catch (err) {
      input.value = "";
      output.value = "";
      hidePreview();
      setUrlStatus(err.message || "Unbekannter Fehler.", "error");
      openFallback();
    } finally {
      fetchUrlBtn.disabled = false;
      fetchUrlBtn.textContent = "Rezept laden";
      hideUrlLoading();
    }
  }

  recipePreview.addEventListener("click", (event) => {
    const button = event.target.closest("[data-portion-delta]");
    if (!button || !baseRecipe) return;

    const delta = Number(button.dataset.portionDelta);
    setPortions(currentServings + delta);
  });

  recipePreview.addEventListener("input", (event) => {
    if (!event.target.classList.contains("portion-input") || !baseRecipe) return;
    setPortions(event.target.value);
  });

  fetchUrlBtn.addEventListener("click", loadRecipeFromUrl);

  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadRecipeFromUrl();
    }
  });

  convertBtn.addEventListener("click", () => {
    showPreviewLoading();
    runConvert();
  });

  input.addEventListener("input", () => {
    if (input.value.trim()) {
      showPreviewLoading();
      runConvert();
    } else {
      output.value = "";
      setStatus("");
      hidePreview();
      setPreviewStatus("");
    }
  });

  output.addEventListener("input", updatePreview);

  previewUpdateBtn.addEventListener("click", updatePreview);

  previewTabBtn.addEventListener("click", () => {
    try {
      openPreviewFromRecipe(getDisplayRecipe());
      setPreviewStatus("Rezeptseite in neuem Tab geöffnet.", "ok");
    } catch (err) {
      setPreviewStatus(err.message || "Tab konnte nicht geöffnet werden.", "error");
    }
  });

  previewPdfBtn.addEventListener("click", () => {
    try {
      printPreviewFromRecipe(getDisplayRecipe());
      setPreviewStatus("Druckdialog geöffnet – „Als PDF sichern“ wählen.", "ok");
    } catch (err) {
      setPreviewStatus(err.message || "PDF-Export fehlgeschlagen.", "error");
    }
  });

  copyMdBtn.addEventListener("click", () => {
    if (!output.value.trim()) {
      setStatus("Zuerst Rezept erzeugen.", "error");
      return;
    }
    copyText(output.value, copyMdBtn);
  });

  clearBtn.addEventListener("click", () => {
    urlInput.value = "";
    input.value = "";
    output.value = "";
    hidePreview();
    hideUrlLoading();
    setStatus("");
    setUrlStatus("");
    setPreviewStatus("");
    urlInput.focus();
  });
});
