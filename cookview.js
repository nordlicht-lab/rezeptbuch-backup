document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("url-input");
  const fetchUrlBtn = document.getElementById("fetch-url-btn");
  const urlStatus = document.getElementById("url-status");
  const fallbackDetails = document.getElementById("fallback-details");
  const input = document.getElementById("json-input");
  const output = document.getElementById("markdown-output");
  const status = document.getElementById("status");
  const convertBtn = document.getElementById("convert-btn");
  const copyCmdBtn = document.getElementById("copy-cmd-btn");
  const copyMdBtn = document.getElementById("copy-md-btn");
  const clearBtn = document.getElementById("clear-btn");
  const previewFrame = document.getElementById("preview-frame");
  const previewEmpty = document.getElementById("preview-empty");
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

  function showPreview() {
    previewFrame.classList.add("is-visible");
    previewEmpty.classList.add("is-hidden");
  }

  function hidePreview() {
    previewFrame.classList.remove("is-visible");
    previewFrame.srcdoc = "";
    previewEmpty.classList.remove("is-hidden");
  }

  function openFallback() {
    fallbackDetails.open = true;
    fallbackDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updatePreview() {
    try {
      renderPreviewInFrame(output.value, previewFrame);
      showPreview();
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

    try {
      fetchUrlBtn.disabled = true;
      fetchUrlBtn.textContent = "Lädt …";
      setUrlStatus("Rezeptseite wird geladen …");

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
      hidePreview();
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
    setStatus("");
    setUrlStatus("");
    setPreviewStatus("");
    urlInput.focus();
  });
});
