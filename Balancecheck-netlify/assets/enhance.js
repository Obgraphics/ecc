/* Enhance — "Other" denomination, front/back photo, per-brand colors */
(function () {
  "use strict";

  /* ── Brand color map ── */
  var brandColors = {
    apple:       { bg: "#1d1d1f", accent: "#a3aaae", text: "#f5f5f7" },
    amazon:      { bg: "#131921", accent: "#ff9900", text: "#ffffff" },
    ebay:        { bg: "#e53238", accent: "#f5af02", text: "#ffffff" },
    sephora:     { bg: "#000000", accent: "#e0115f", text: "#ffffff" },
    nordstrom:   { bg: "#1a1a2e", accent: "#c9a96e", text: "#ffffff" },
    steam:       { bg: "#1b2838", accent: "#66c0f4", text: "#ffffff" },
    razer:       { bg: "#111111", accent: "#44d62c", text: "#ffffff" },
    xbox:        { bg: "#107c10", accent: "#c6f5bf", text: "#ffffff" },
    playstation: { bg: "#00439c", accent: "#a9cdff", text: "#ffffff" },
    google:      { bg: "#ffffff", accent: "#4285f4", text: "#1d1d1f" },
    spotify:     { bg: "#191414", accent: "#1db954", text: "#ffffff" },
    hulu:        { bg: "#1ce783", accent: "#040405", text: "#040405" },
    paramount:   { bg: "#0064ff", accent: "#0033a0", text: "#ffffff" },
    visa:        { bg: "#1a1f71", accent: "#f7b600", text: "#ffffff" },
    vanilla:     { bg: "#f5e6d3", accent: "#c8a97e", text: "#3b2f2f" },
    amex:        { bg: "#006fcf", accent: "#00175a", text: "#ffffff" },
    other:       { bg: "#2c2c2e", accent: "#8e8e93", text: "#f5f5f7" }
  };

  /* ── Apply brand colors to brand picker cards ── */
  function applyBrandColors() {
    var cards = document.querySelectorAll('button[aria-pressed]');
    cards.forEach(function (btn) {
      var img = btn.querySelector('img[src*="/photos/brands/"]');
      if (!img) return;
      var src = img.getAttribute("src") || "";
      var match = src.match(/brands\/(\w+)\.jpg/);
      if (!match) return;
      var id = match[1];
      var c = brandColors[id];
      if (!c) return;
      if (btn.getAttribute("data-bc-colored")) return;
      btn.setAttribute("data-bc-colored", "1");

      var caption = btn.querySelector("span.block.p-4, span:last-child");
      if (caption && caption.classList.contains("p-4")) {
        caption.style.background = c.bg;
        caption.style.color = c.text;
        var sub = caption.querySelector(".text-mist");
        if (sub) sub.style.color = c.accent;
      }
    });
  }

  /* ── "Other" denomination button ── */
  function injectOtherDenom() {
    var scrollRows = document.querySelectorAll(".no-scrollbar");
    scrollRows.forEach(function (row) {
      if (row.getAttribute("data-bc-other")) return;
      var pills = row.querySelectorAll('button[aria-pressed]');
      if (pills.length < 3) return;
      /* Check this is a denomination row (buttons have currency values) */
      var first = pills[0];
      if (!first || !/[\$£€¥]?\d/.test(first.textContent)) return;

      row.setAttribute("data-bc-other", "1");
      var otherBtn = document.createElement("button");
      otherBtn.type = "button";
      otherBtn.textContent = "Other";
      otherBtn.className = first.className.replace(/bg-paper text-ink/g, "bg-panel text-mist");
      otherBtn.setAttribute("aria-pressed", "false");
      otherBtn.style.cssText = "flex-shrink:0;";
      otherBtn.addEventListener("click", function () {
        /* Deselect all pills */
        pills.forEach(function (p) {
          p.setAttribute("aria-pressed", "false");
          p.className = p.className.replace(/bg-paper text-ink/g, "bg-panel text-mist");
        });
        otherBtn.setAttribute("aria-pressed", "true");
        otherBtn.className = otherBtn.className.replace(/bg-panel text-mist/g, "bg-paper text-ink");
        /* Clear and focus the manual input (React needs the native setter) */
        var input = row.parentElement && row.parentElement.querySelector('input[inputmode="numeric"]');
        if (input) {
          var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
          input.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
      row.appendChild(otherBtn);
    });
  }

  /* ── Front and back photo upload for verify flow ── */
  function injectBackPhoto() {
    if (!location.pathname.startsWith("/verify")) return;
    var photoLabels = document.querySelectorAll("span.text-sm.text-mist");
    var photoSection = null;
    photoLabels.forEach(function (el) {
      var t = el.textContent.trim();
      if (t === "Photo" || t === "Front of card") {
        photoSection = el.closest("div");
        el.textContent = "Front of card";
      }
    });
    if (!photoSection) return;
    if (document.getElementById("bc-back-photo-section")) return;

    var backSection = document.createElement("div");
    backSection.id = "bc-back-photo-section";
    backSection.className = "mt-4";
    backSection.innerHTML =
      '<span class="mb-2 block text-sm text-mist">Back of card</span>' +
      '<label class="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-panel px-4 text-sm shadow-hairline" style="box-shadow:var(--card-shadow)">' +
        '<span id="bc-back-photo-name">Add a photo</span>' +
        '<input id="bc-back-photo-input" type="file" accept="image/*" class="sr-only" />' +
      '</label>' +
      '<img id="bc-back-photo-preview" alt="Back of card" class="frame mt-3 w-full rounded-2xl" style="display:none" />';

    photoSection.parentElement.insertBefore(backSection, photoSection.nextSibling);

    var input = document.getElementById("bc-back-photo-input");
    var preview = document.getElementById("bc-back-photo-preview");
    var nameEl = document.getElementById("bc-back-photo-name");
    if (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        nameEl.textContent = file.name;
        var reader = new FileReader();
        reader.onload = function (ev) {
          preview.src = ev.target.result;
          preview.style.display = "block";
          try { sessionStorage.setItem("bc_back_photo", ev.target.result); } catch {}
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ── Main observer ── */
  var debounce = null;
  function enhance() {
    applyBrandColors();
    injectOtherDenom();
    injectBackPhoto();
  }

  var obs = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(enhance, 200);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(enhance, 400);
})();
