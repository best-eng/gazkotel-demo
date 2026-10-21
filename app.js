/* ГазКотел: меню, кнопки «Вызвать мастера», отправка заявки, поиск по зоне выезда, cookie. */
(function () {
  "use strict";

  var body = document.body;

  function goal(name) {
    if (window.ym && window.metrikaId) window.ym(window.metrikaId, "reachGoal", name);
  }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------- меню на телефоне ---------- */
  var toggle = document.querySelector(".menu-toggle");
  function closeMenu() {
    body.classList.remove("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav a").forEach(function (a) { a.addEventListener("click", closeMenu); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  document.querySelectorAll("[data-goal]").forEach(function (a) {
    a.addEventListener("click", function () { goal(a.getAttribute("data-goal")); });
  });

  /* ---------- кнопки, которые ведут к форме и подставляют марку и неисправность ---------- */
  var forms = Array.prototype.slice.call(document.querySelectorAll("[data-lead-form]"));
  var main = document.getElementById("zayavka") || forms[0];

  function setSelect(select, value) {
    if (!select || !value) return;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].text === value) { select.selectedIndex = i; return; }
    }
  }

  document.querySelectorAll("[data-call]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (!main) return;
      e.preventDefault();
      closeMenu();
      setSelect(main.elements.brand, el.getAttribute("data-brand"));
      setSelect(main.elements.problem, el.getAttribute("data-problem"));
      main.scrollIntoView({ behavior: "smooth", block: "center" });
      main.classList.remove("flash");
      void main.offsetWidth;
      main.classList.add("flash");
      setTimeout(function () {
        var phone = main.elements.phone;
        if (phone && !main.classList.contains("sent")) phone.focus({ preventScroll: true });
      }, 450);
    });
  });

  /* ---------- заявка ---------- */
  function digits(s) { return (s || "").replace(/\D/g, ""); }

  function prettyPhone(value) {
    var d = digits(value);
    if (d.length === 11 && (d[0] === "8" || d[0] === "7")) d = d.slice(1);
    if (d.length !== 10) return value.trim();
    return "+7 (" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6, 8) + "-" + d.slice(8);
  }

  var telLink = document.querySelector('a[href^="tel:"]');
  var telText = telLink ? telLink.textContent.trim() : "";

  forms.forEach(function (form) {
    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");
    var phone = form.elements.phone;
    var consent = form.elements.consent;

    phone.addEventListener("blur", function () { if (phone.value) phone.value = prettyPhone(phone.value); });
    phone.addEventListener("input", function () { phone.closest(".field").classList.remove("invalid"); });
    consent.addEventListener("change", function () { consent.closest(".check").classList.remove("invalid"); });

    function say(text, kind) {
      status.textContent = text;
      status.className = "form-status" + (kind ? " " + kind : "");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var count = digits(phone.value).length;
      if (count < 10 || count > 15) {
        phone.closest(".field").classList.add("invalid");
        say("Проверьте номер телефона: нужен номер из 10–11 цифр.", "err");
        phone.focus();
        return;
      }
      if (!consent.checked) {
        consent.closest(".check").classList.add("invalid");
        say("Отметьте согласие на обработку персональных данных.", "err");
        return;
      }
      phone.value = prettyPhone(phone.value);
      if (form.hasAttribute("data-demo")) {               // демо-копия без сервера (tools/demo.py)
        form.classList.add("sent");
        say("Это демо-версия сайта: заявки начнут приходить в Telegram после переноса на хостинг.", "ok");
        return;
      }
      var data = new FormData(form);
      data.append("page", location.pathname);
      button.disabled = true;
      say("Отправляем…", "");

      fetch(form.action, { method: "POST", body: data, headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.error || "");
          form.classList.add("sent");
          say("Заявка отправлена. Перезвоним в ближайшее время — с 8:00 до 23:00 ежедневно.", "ok");
          goal("zayavka");
        })
        .catch(function (err) {
          say((err && err.message ? err.message + " " : "Не получилось отправить заявку. ")
            + "Позвоните нам: " + telText, "err");
        })
        .then(function () { button.disabled = false; });
    });
  });

  /* ---------- дисплей котла: коды ошибок по очереди ---------- */
  var lcd = document.querySelector("[data-lcd]");
  if (lcd && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var codes = (lcd.getAttribute("data-codes") || "").split(",").filter(Boolean);
    var n = 0;
    // плавная смена кода: старый гаснет, новый проявляется
    if (codes.length > 1) setInterval(function () {
      lcd.classList.add("out");
      setTimeout(function () {
        n = (n + 1) % codes.length;
        lcd.textContent = codes[n];
        lcd.classList.remove("out");
      }, 450);
    }, 3000);
  }

  /* ---------- поиск по зоне выезда ---------- */
  var filter = document.querySelector("[data-zone-filter]");
  if (filter) {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-zone-list] li[data-name]"));
    var groups = Array.prototype.slice.call(document.querySelectorAll("[data-zone-list] [data-group]"));
    var empty = document.querySelector("[data-zone-empty]");
    var norm = function (s) { return s.toLowerCase().replace(/ё/g, "е").trim(); };

    var apply = function () {
      var q = norm(filter.value);
      var shown = 0;
      items.forEach(function (li) {
        var hit = !q || li.getAttribute("data-name").indexOf(q) !== -1;
        li.hidden = !hit;
        if (hit) shown++;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector("li:not([hidden])"); });
      if (empty) empty.hidden = shown > 0;
    };
    filter.addEventListener("input", apply);
    var q = new URLSearchParams(location.search).get("q");
    if (q) { filter.value = q; apply(); }
  }

  /* ---------- cookie и Метрика: только после согласия ---------- */
  var bar = document.querySelector("[data-cookie]");
  if (bar) {
    var loadMetrika = function () {
      if (window.metrikaId) return;
      var s = document.createElement("script");
      s.src = bar.getAttribute("data-metrika");
      s.async = true;
      document.head.appendChild(s);
    };
    var choice = store("cookie-consent");
    if (choice === "yes") loadMetrika();
    else if (choice !== "no") bar.hidden = false;
    bar.querySelector("[data-cookie-yes]").addEventListener("click", function () {
      store("cookie-consent", "yes"); bar.hidden = true; loadMetrika();
    });
    bar.querySelector("[data-cookie-no]").addEventListener("click", function () {
      store("cookie-consent", "no"); bar.hidden = true;
    });
    document.querySelectorAll("[data-cookie-reset]").forEach(function (b) {
      b.addEventListener("click", function () { store("cookie-consent", null); bar.hidden = false; });
    });
  }
})();
