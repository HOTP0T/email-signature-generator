/* Email signature generator: builds an email signature as table-based HTML with inline styles,
   the only markup Gmail, Outlook and Apple Mail all keep. Everything stays in the browser. */
(function () {
  "use strict";

  var STORE = "email-signature-generator.v1";
  var GMAIL_LIMIT = 10000;
  var UPLOAD_MAX_PX = 256; // twice the widest logo the form offers
  var MAX_AFF = 5;

  // Fonts every reader has; a web font would silently fall back in most mail apps.
  var FONTS = {
    system: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    arial: "Arial,Helvetica,sans-serif",
    verdana: "Verdana,Geneva,sans-serif",
    tahoma: "Tahoma,Verdana,Geneva,sans-serif",
    trebuchet: "'Trebuchet MS',Helvetica,Arial,sans-serif",
    georgia: "Georgia,'Times New Roman',Times,serif",
    times: "'Times New Roman',Times,serif"
  };

  var SOCIALS = [
    ["linkedin", "LinkedIn"],
    ["x", "X"],
    ["github", "GitHub"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["youtube", "YouTube"]
  ];

  var STANDARD_DISCLAIMER = "This email and any attachments are confidential and may be legally privileged. " +
    "They are intended only for the person or company they are addressed to. If you received this email by mistake, " +
    "please tell the sender and delete it. Do not copy, forward or use its contents.";

  var EXAMPLE = {
    name: "Alex Morgan",
    title: "Head of Operations",
    company: "Northwind Studio",
    tagline: "Design and print for independent brands",
    tagline_caps: true,
    affiliations: [{ text: "Founding member of the Independent Print Network", url: "" }],
    phone: "+1 415 555 0134",
    mobile: "",
    email: "alex@northwind.example",
    website: "https://northwind.example",
    address: "18 Harbor Street, San Francisco, CA 94111",
    wechat: "",
    labels: true,
    linkedin: "https://www.linkedin.com/in/alex-morgan-example",
    x: "",
    github: "",
    instagram: "https://www.instagram.com/northwind.example",
    facebook: "",
    youtube: "",
    cta_label: "",
    cta_url: "",
    logo_type: "initials",
    logo_initials: "",
    logo_url: "",
    logo_size: 64,
    logo_shape: "rounded",
    logo_link: "",
    layout: "side",
    accent: "#0e7c66",
    text: "#16181d",
    muted: "#5e6573",
    divider: true,
    divider_color: "#dadfe6",
    font: "system",
    size: 13,
    disclaimer: STANDARD_DISCLAIMER,
    // Not form fields: an uploaded image and the size of whichever image is in use.
    logo_upload: "",
    logo_upload_name: "",
    logo_nw: 0,
    logo_nh: 0
  };

  var CHOICES = {
    logo_type: ["none", "initials", "image"],
    logo_shape: ["square", "rounded", "circle"],
    layout: ["side", "stacked"],
    font: Object.keys(FONTS)
  };
  var RANGES = { logo_size: [32, 128], size: [12, 15], logo_nw: [0, 100000], logo_nh: [0, 100000] };
  var COLORS = ["accent", "text", "muted", "divider_color"];
  var NUMBERS = ["logo_size", "size"];
  // What a brand link carries. Personal details never go into a link.
  var BRAND = ["company", "tagline", "tagline_caps", "affiliations", "website", "address", "labels", "disclaimer",
    "logo_type", "logo_initials", "logo_url", "logo_size", "logo_shape", "logo_link",
    "layout", "accent", "text", "muted", "divider", "divider_color", "font", "size"];
  var PERSONAL = ["name", "title", "phone", "mobile", "email", "wechat",
    "linkedin", "x", "github", "instagram", "facebook", "youtube", "cta_label", "cta_url"];

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function webUrl(u) {
    u = (u || "").trim();
    if (!u) return "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u;
    try {
      var x = new URL(u);
      return x.protocol === "https:" || x.protocol === "http:" ? x.href : "";
    } catch (e) { return ""; }
  }
  function shortUrl(u) { return u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""); }
  function telHref(p) {
    var t = p.replace(/[^\d+]/g, "");
    return t.replace(/\D/g, "").length >= 5 ? "tel:" + t : "";
  }
  function emailOk(e) { return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e); }

  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function textOn(hex) {
    var l = luminance(hex);
    return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.05) ? "#ffffff" : "#111111";
  }

  function toB64url(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64url(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // Keeps only known keys with the right type and range; used for storage and brand links alike.
  function clean(src) {
    var out = {};
    if (!src || typeof src !== "object") return out;
    Object.keys(EXAMPLE).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) return;
      var v = src[k], def = EXAMPLE[k];
      if (k === "affiliations") {
        if (!Array.isArray(v)) return;
        out[k] = v.filter(function (a) { return a && typeof a.text === "string" && typeof a.url === "string"; })
          .slice(0, MAX_AFF)
          .map(function (a) { return { text: a.text.slice(0, 300), url: a.url.slice(0, 1000) }; });
        return;
      }
      if (typeof v !== typeof def) return;
      if (CHOICES[k] && CHOICES[k].indexOf(v) < 0) return;
      if (RANGES[k]) v = Math.min(RANGES[k][1], Math.max(RANGES[k][0], Math.round(v) || 0));
      if (COLORS.indexOf(k) >= 0) {
        if (!/^#[0-9a-f]{6}$/i.test(v)) return;
        v = v.toLowerCase();
      }
      if (k === "logo_upload" && v && !/^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return;
      if (typeof v === "string" && k !== "logo_upload") v = v.slice(0, 5000);
      out[k] = v;
    });
    return out;
  }
  // A copy of the example whose list can't be changed through the state.
  function freshExample() {
    var s = Object.assign({}, EXAMPLE);
    s.affiliations = EXAMPLE.affiliations.map(function (a) { return Object.assign({}, a); });
    return s;
  }
  function pick(obj, keys) {
    var out = {};
    keys.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; });
    return out;
  }

  /* ---------- the signature ---------- */

  function initialsFor(s) {
    var own = s.logo_initials.trim();
    if (own) return Array.from(own).slice(0, 3).join("");
    var src = s.company.trim() || s.name.trim();
    if (!src) return "";
    var words = src.split(/\s+/).filter(Boolean);
    var letters = words.length > 1 ? [Array.from(words[0])[0], Array.from(words[1])[0]] : [Array.from(words[0])[0]];
    return letters.join("").toLocaleUpperCase();
  }
  function imageUrl(s) { return webUrl(s.logo_url); }
  function imageSrc(s) { return s.logo_upload || imageUrl(s); }

  function logoHtml(s, font) {
    if (s.logo_type === "none") return "";
    var size = s.logo_size;
    var radius = s.logo_shape === "circle" ? "50%" : s.logo_shape === "rounded" ? Math.round(size * 0.18) + "px" : "0";
    var href = webUrl(s.logo_link) || webUrl(s.website);

    if (s.logo_type === "initials") {
      var t = initialsFor(s);
      if (!t) return "";
      var fg = textOn(s.accent);
      var fs = Math.round(size * (Array.from(t).length > 2 ? 0.3 : 0.38));
      var inner = href
        ? '<a href="' + esc(href) + '" style="color:' + fg + ';text-decoration:none;">' + esc(t) + "</a>"
        : esc(t);
      return '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:separate;">' +
        '<tr><td width="' + size + '" height="' + size + '" align="center" valign="middle" bgcolor="' + s.accent + '" style="' +
        "width:" + size + "px;height:" + size + "px;background-color:" + s.accent + ";border-radius:" + radius + ";" +
        "color:" + fg + ";font-family:" + font + ";font-size:" + fs + "px;line-height:" + size + "px;" +
        'font-weight:700;text-align:center;">' + inner + "</td></tr></table>";
    }

    var src = imageSrc(s);
    if (!src) return "";
    var h = s.logo_nw && s.logo_nh ? Math.round(size * s.logo_nh / s.logo_nw) : 0;
    var alt = s.company.trim() || s.name.trim() || "Logo";
    var img = '<img src="' + esc(src) + '" width="' + size + '"' + (h ? ' height="' + h + '"' : "") +
      ' alt="' + esc(alt) + '" style="display:block;width:' + size + "px;" + (h ? "height:" + h + "px;" : "height:auto;") +
      "border:0;outline:none;text-decoration:none;border-radius:" + radius + ';">';
    return href ? '<a href="' + esc(href) + '" style="text-decoration:none;">' + img + "</a>" : img;
  }

  function buildHtml(s) {
    var font = FONTS[s.font] || FONTS.system;
    var ff = "font-family:" + font + ";";
    var base = s.size, lh = Math.round(base * 1.5);
    var table = '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">';
    var line = "font-size:" + base + "px;line-height:" + lh + "px;color:" + s.muted + ";";
    var sep = '<span style="color:' + s.muted + ';">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>';
    // Outlook doesn't pass the font down from a table, so every text cell names it.
    function row(inner, style) { return '<tr><td style="' + ff + style + '">' + inner + "</td></tr>"; }
    function link(href, label, color, extra) {
      return '<a href="' + esc(href) + '" style="color:' + color + ";text-decoration:none;" + (extra || "") + '">' + label + "</a>";
    }
    function tag(letter, inner, always) {
      return (s.labels || always)
        ? '<span style="color:' + s.accent + ';font-weight:700;">' + letter + "</span>&nbsp;&nbsp;" + inner
        : inner;
    }
    var rows = [];
    function gap(px) { return rows.length ? "padding-top:" + px + "px;" : ""; }

    var name = s.name.trim();
    if (name) rows.push(row(esc(name), "font-size:" + (base + 3) + "px;line-height:" + (lh + 4) + "px;font-weight:700;color:" + s.text + ";"));
    var role = [];
    if (s.title.trim()) role.push(esc(s.title.trim()));
    if (s.company.trim()) role.push('<span style="color:' + s.text + ';font-weight:600;">' + esc(s.company.trim()) + "</span>");
    if (role.length) rows.push(row(role.join(sep), line));

    var phones = [], online = [];
    var phone = s.phone.trim(), mobile = s.mobile.trim(), wechat = s.wechat.trim();
    if (phone) phones.push(tag("T", telHref(phone) ? link(telHref(phone), esc(phone), s.muted) : esc(phone)));
    if (mobile) phones.push(tag("M", telHref(mobile) ? link(telHref(mobile), esc(mobile), s.muted) : esc(mobile)));
    if (wechat) phones.push(tag("WeChat", esc(wechat), true));
    var email = s.email.trim(), site = webUrl(s.website);
    if (email) online.push(tag("E", emailOk(email) ? link("mailto:" + email, esc(email), s.muted) : esc(email)));
    if (site) online.push(tag("W", link(site, esc(shortUrl(site)), s.accent, "font-weight:600;")));
    var contact = [];
    if (phones.length) contact.push(phones.join(sep));
    if (online.length) contact.push(online.join(sep));
    if (s.address.trim()) contact.push(esc(s.address.trim()));
    contact.forEach(function (c, i) { rows.push(row(c, line + (i === 0 ? gap(8) : ""))); });

    var social = SOCIALS.map(function (p) {
      var u = webUrl(s[p[0]]);
      return u ? link(u, p[1], s.accent, "font-weight:600;") : "";
    }).filter(Boolean);
    if (social.length) rows.push(row(social.join(sep), line + gap(8)));

    var cta = s.cta_label.trim(), ctaUrl = webUrl(s.cta_url);
    if (cta && ctaUrl) rows.push(row(link(ctaUrl, esc(cta) + "&nbsp;&rarr;", s.accent, "font-weight:700;"), line + gap(8)));

    var firstAff = true;
    s.affiliations.forEach(function (a) {
      var t = a.text.trim();
      if (!t) return;
      var u = webUrl(a.url);
      rows.push(row(u ? link(u, esc(t), s.muted, "text-decoration:underline;") : esc(t),
        "font-size:" + (base - 1) + "px;line-height:" + (lh - 1) + "px;color:" + s.muted + ";" + (firstAff ? gap(10) : "")));
      firstAff = false;
    });

    var tagline = s.tagline.trim();
    if (tagline) {
      rows.push(row(esc(s.tagline_caps ? tagline.toLocaleUpperCase() : tagline),
        "font-size:" + (base - 2) + "px;line-height:" + (lh - 2) + "px;color:" + s.muted + ";" +
        (s.tagline_caps ? "letter-spacing:0.08em;" : "font-style:italic;") + gap(10)));
    }

    var info = rows.length ? table + rows.join("") + "</table>" : "";
    var logo = logoHtml(s, font);
    var border = s.divider ? "1px solid " + s.divider_color : "";
    var main;
    if (logo && info) {
      if (s.layout === "stacked") {
        main = table +
          '<tr><td style="padding:0 0 12px;">' + logo + "</td></tr>" +
          '<tr><td style="' + (border ? "padding:12px 0 0;border-top:" + border + ";" : "padding:0;") + '">' + info + "</td></tr></table>";
      } else {
        main = table + "<tr>" +
          '<td valign="top" style="padding:0 ' + (border ? 16 : 18) + 'px 0 0;vertical-align:top;">' + logo + "</td>" +
          '<td valign="top" style="' + (border ? "padding:0 0 0 16px;border-left:" + border + ";" : "padding:0;") + 'vertical-align:top;">' + info + "</td>" +
          "</tr></table>";
      }
    } else {
      main = logo || info;
    }

    var note = s.disclaimer.trim();
    if (!note) return main;
    var noteTable = '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;max-width:560px;">' +
      '<tr><td style="' + ff + (border ? "padding:10px 0 0;border-top:" + border + ";" : "padding:0;") +
      "font-size:" + Math.max(10, base - 2) + "px;line-height:" + Math.max(14, lh - 3) + "px;color:" + s.muted + ';">' +
      esc(note).replace(/\r?\n/g, "<br>") + "</td></tr></table>";
    if (!main) return noteTable;
    return table + '<tr><td style="padding:0;">' + main + "</td></tr>" +
      '<tr><td style="padding:18px 0 0;">' + noteTable + "</td></tr></table>";
  }

  function buildText(s) {
    var out = [];
    function lab(letter, v, always) { return (s.labels || always) ? letter + " " + v : v; }
    if (s.name.trim()) out.push(s.name.trim());
    var role = [s.title.trim(), s.company.trim()].filter(Boolean).join(" · ");
    if (role) out.push(role);
    var phones = [];
    if (s.phone.trim()) phones.push(lab("T", s.phone.trim()));
    if (s.mobile.trim()) phones.push(lab("M", s.mobile.trim()));
    if (s.wechat.trim()) phones.push(lab("WeChat", s.wechat.trim(), true));
    if (phones.length) out.push(phones.join(" · "));
    var online = [], site = webUrl(s.website);
    if (s.email.trim()) online.push(lab("E", s.email.trim()));
    if (site) online.push(lab("W", shortUrl(site)));
    if (online.length) out.push(online.join(" · "));
    if (s.address.trim()) out.push(s.address.trim());
    var social = SOCIALS.map(function (p) { var u = webUrl(s[p[0]]); return u ? p[1] + ": " + u : ""; }).filter(Boolean);
    out = out.concat(social);
    var ctaUrl = webUrl(s.cta_url);
    if (s.cta_label.trim() && ctaUrl) out.push(s.cta_label.trim() + ": " + ctaUrl);
    s.affiliations.forEach(function (a) {
      var u = webUrl(a.url);
      if (a.text.trim()) out.push(a.text.trim() + (u ? " (" + shortUrl(u) + ")" : ""));
    });
    if (s.tagline.trim()) out.push(s.tagline.trim());
    var text = out.join("\n"), note = s.disclaimer.trim();
    return note ? (text ? text + "\n\n" : "") + note : text;
  }

  // Line breaks only between table tags, so no stray spaces land in the text.
  function pretty(html) {
    var depth = 0;
    return html.split(/(?=<\/?(?:table|tr|td)\b)/).map(function (p) {
      var closing = p.charAt(1) === "/";
      if (closing) depth = Math.max(0, depth - 1);
      var out = new Array(depth + 1).join("  ") + p;
      if (!closing && /^<(table|tr|td)\b/.test(p)) depth++;
      return out;
    }).join("\n");
  }

  /* ---------- state ---------- */

  function readSaved() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? clean(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function readBrandHash() {
    var m = location.hash.match(/^#brand=([A-Za-z0-9_-]+)$/);
    if (!m) return null;
    try { return pick(clean(JSON.parse(fromB64url(m[1]))), BRAND); } catch (e) { return null; }
  }

  var saved = readSaved();
  var brand = readBrandHash();
  var state = Object.assign(freshExample(), saved || {});
  // Example lines never join details someone saved before this field existed.
  if (saved && !saved.affiliations) state.affiliations = [];
  var fromBrandLink = false;
  if (brand) {
    if (!saved) PERSONAL.forEach(function (k) { state[k] = ""; });
    Object.assign(state, brand);
    if (!brand.affiliations) state.affiliations = [];
    state.logo_upload = "";
    state.logo_upload_name = "";
    state.logo_nw = state.logo_nh = 0;
    fromBrandLink = true;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    save();
  }

  /* ---------- page ---------- */

  var form = document.getElementById("form");
  var sigEl = document.getElementById("sig");
  var codeEl = document.getElementById("code");
  var statusEl = document.getElementById("status");
  var warningsEl = document.getElementById("warnings");
  var savedEl = document.getElementById("saved");
  var fileInput = document.getElementById("f-logo-file");
  var affList = document.getElementById("aff-list");
  var affAdd = document.getElementById("aff-add");
  var html = "";
  var imgStatus = "none"; // none | loading | ok | error

  // Rebuilt only when rows are added or removed, so typing never loses focus.
  function renderAffRows() {
    var x = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    affList.innerHTML = state.affiliations.map(function (a, i) {
      var n = i + 1;
      return '<div class="aff-row">' +
        '<div class="field aff-text"><label for="f-aff-' + i + '-text">Affiliation ' + n + "</label>" +
        '<input id="f-aff-' + i + '-text" type="text" data-aff="' + i + '" data-field="text" placeholder="e.g. An independent member of …" value="' + esc(a.text) + '"></div>' +
        '<button type="button" class="icon-btn" data-aff-remove="' + i + '" aria-label="Remove affiliation ' + n + '">' + x + "</button>" +
        '<div class="field aff-url"><label for="f-aff-' + i + '-url">Link <span class="opt">optional</span></label>' +
        '<input id="f-aff-' + i + '-url" type="url" data-aff="' + i + '" data-field="url" placeholder="https://…" value="' + esc(a.url) + '"></div>' +
        "</div>";
    }).join("");
    affAdd.hidden = state.affiliations.length >= MAX_AFF;
  }

  function fillForm() {
    renderAffRows();
    Array.prototype.forEach.call(form.elements, function (el) {
      var k = el.name;
      if (!k || !(k in state) || el.type === "file") return;
      if (el.type === "radio") el.checked = el.value === String(state[k]);
      else if (el.type === "checkbox") el.checked = !!state[k];
      else el.value = state[k];
    });
    COLORS.forEach(function (k) {
      var hex = form.querySelector('[data-hex-for="' + k + '"]');
      if (hex && document.activeElement !== hex) hex.value = state[k].toUpperCase();
    });
    syncVisibility();
  }

  function syncVisibility() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-when]"), function (el) {
      var m = el.getAttribute("data-when").match(/^(\w+)(!?=)(\w+)$/);
      if (!m) return;
      var v = String(state[m[1]]);
      el.hidden = m[2] === "=" ? v !== m[3] : v === m[3];
    });
    document.getElementById("size-out").textContent = state.logo_size + " px";
    var chip = document.getElementById("upload-chip");
    chip.hidden = !state.logo_upload;
    document.getElementById("upload-hint").hidden = !!state.logo_upload;
    document.getElementById("upload-name").textContent = state.logo_upload ? (state.logo_upload_name || "Uploaded image") + ", used instead of the link" : "";
  }

  var ICONS = {
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };

  function warningsFor(s) {
    var w = [];
    if (s.logo_type === "image") {
      if (s.logo_upload) {
        w.push(["warn", "The uploaded image is embedded in the signature itself: it isn't put online and has no link. Apple Mail and Outlook send it with each email, but Gmail removes it. For Gmail, put the image online and paste its link under Image link."]);
      } else if (!s.logo_url.trim()) {
        w.push(["info", "Paste a link to your logo or photo, or upload an image."]);
      } else if (!imageUrl(s)) {
        w.push(["warn", "The image link isn't a web address. It should start with https://."]);
      } else {
        if (imgStatus === "error") w.push(["warn", "The image didn't load. Check that the link opens the image itself, not a page around it, and that anyone can open it."]);
        if (/^http:/i.test(s.logo_url.trim())) w.push(["warn", "Use an https:// link. Some mail apps block images sent over http."]);
      }
      if (imageSrc(s) && s.logo_nw && s.logo_nh) {
        if (s.logo_shape === "circle" && Math.abs(s.logo_nw - s.logo_nh) > 2) w.push(["info", "A circle only looks round with a square image."]);
        if (s.logo_nw < s.logo_size * 2) w.push(["info", "The image is " + s.logo_nw + " px wide. Use one at least " + (s.logo_size * 2) + " px wide so it stays sharp on high-resolution screens."]);
      }
    }
    if (s.email.trim() && !emailOk(s.email.trim())) w.push(["info", "The email address looks incomplete, so it isn't a link yet."]);
    if (html.length > GMAIL_LIMIT) {
      w.push(["warn", "Gmail accepts signatures up to 10,000 characters and this one is " + html.length.toLocaleString("en-US") + "." +
        (s.logo_upload ? " The uploaded image takes most of it; an image link fixes this." : "")]);
    }
    return w;
  }

  function render() {
    html = buildHtml(state);
    sigEl.innerHTML = html || '<p class="sig-empty">Your signature appears here once you fill in the form.</p>';
    codeEl.textContent = pretty(html);

    var n = html.length;
    var meter = document.getElementById("meter");
    meter.classList.toggle("over", n > GMAIL_LIMIT);
    document.getElementById("meter-text").textContent = n.toLocaleString("en-US") + " of " + GMAIL_LIMIT.toLocaleString("en-US") + " characters";
    document.getElementById("meter-fill").style.width = Math.min(100, n / GMAIL_LIMIT * 100) + "%";

    warningsEl.innerHTML = warningsFor(state).map(function (w) {
      return '<li class="' + w[0] + '">' + ICONS[w[0]] + "<span>" + esc(w[1]) + "</span></li>";
    }).join("");
  }

  var savedTimer;
  function changed() {
    render();
    if (save()) {
      savedEl.textContent = "Saved in this browser.";
      clearTimeout(savedTimer);
      savedTimer = setTimeout(function () { savedEl.textContent = ""; }, 2000);
    }
  }

  // Reads the image once to learn its proportions, so the HTML can carry an exact height (Outlook needs it).
  var probeTimer, probeToken = 0;
  function probeImage() {
    var src = imageSrc(state), token = ++probeToken;
    state.logo_nw = state.logo_nh = 0;
    if (!src) { imgStatus = "none"; return; }
    imgStatus = "loading";
    var im = new Image();
    im.onload = function () {
      if (token !== probeToken) return;
      state.logo_nw = im.naturalWidth;
      state.logo_nh = im.naturalHeight;
      imgStatus = "ok";
      changed();
    };
    im.onerror = function () {
      if (token !== probeToken) return;
      imgStatus = "error";
      changed();
    };
    im.src = src;
  }
  function scheduleProbe() {
    clearTimeout(probeTimer);
    probeTimer = setTimeout(probeImage, 400);
  }

  function onField(e) {
    var el = e.target;
    if (el.dataset && el.dataset.hexFor) {
      var v = el.value.trim();
      if (v.charAt(0) !== "#") v = "#" + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        state[el.dataset.hexFor] = v.toLowerCase();
        form.elements[el.dataset.hexFor].value = v.toLowerCase();
        changed();
      }
      return;
    }
    if (el.dataset && el.dataset.aff !== undefined) {
      var i = Number(el.dataset.aff), f = el.dataset.field;
      if (!state.affiliations[i] || state.affiliations[i][f] === el.value) return;
      state.affiliations = state.affiliations.map(function (a, j) {
        if (j !== i) return a;
        var c = Object.assign({}, a);
        c[f] = el.value;
        return c;
      });
      changed();
      return;
    }
    var k = el.name;
    if (!k || !(k in state) || el.type === "file") return;
    var val;
    if (el.type === "checkbox") val = el.checked;
    else if (el.type === "radio") { if (!el.checked) return; val = el.value; }
    else if (NUMBERS.indexOf(k) >= 0) val = Number(el.value);
    else val = el.value;
    if (state[k] === val) return;
    state[k] = val;
    if (COLORS.indexOf(k) >= 0) {
      var hex = form.querySelector('[data-hex-for="' + k + '"]');
      if (hex) hex.value = String(val).toUpperCase();
    }
    if (k === "logo_url") { state.logo_nw = state.logo_nh = 0; scheduleProbe(); }
    if (k === "logo_type" && val === "image") probeImage();
    syncVisibility();
    changed();
  }
  form.addEventListener("input", onField);
  form.addEventListener("change", onField);
  form.addEventListener("focusout", function (e) {
    if (e.target.dataset && e.target.dataset.hexFor) e.target.value = state[e.target.dataset.hexFor].toUpperCase();
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  // Uploads are scaled down so the embedded image stays small.
  fileInput.addEventListener("change", function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) { setStatus("Choose a PNG, JPEG, GIF or WebP image."); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var im = new Image();
      im.onload = function () {
        var scale = Math.min(1, UPLOAD_MAX_PX / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.naturalWidth * scale));
        c.height = Math.max(1, Math.round(im.naturalHeight * scale));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        state.logo_upload = f.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.88) : c.toDataURL("image/png");
        state.logo_upload_name = f.name;
        state.logo_type = "image";
        fillForm();
        probeImage();
        changed();
      };
      im.onerror = function () { setStatus("That file couldn't be read as an image."); };
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
  });
  document.getElementById("upload-remove").addEventListener("click", function () {
    state.logo_upload = "";
    state.logo_upload_name = "";
    fillForm();
    probeImage();
    changed();
  });

  affAdd.addEventListener("click", function () {
    if (state.affiliations.length >= MAX_AFF) return;
    state.affiliations = state.affiliations.concat([{ text: "", url: "" }]);
    renderAffRows();
    changed();
    document.getElementById("f-aff-" + (state.affiliations.length - 1) + "-text").focus();
  });
  affList.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-aff-remove]");
    if (!btn) return;
    var i = Number(btn.getAttribute("data-aff-remove"));
    state.affiliations = state.affiliations.filter(function (_, j) { return j !== i; });
    renderAffRows();
    changed();
    var next = state.affiliations.length ? document.getElementById("f-aff-" + Math.min(i, state.affiliations.length - 1) + "-text") : affAdd;
    next.focus();
  });

  document.getElementById("std-disclaimer").addEventListener("click", function () {
    state.disclaimer = STANDARD_DISCLAIMER;
    fillForm();
    changed();
  });
  document.getElementById("reset").addEventListener("click", function () {
    state = freshExample();
    imgStatus = "none";
    fillForm();
    changed();
    setStatus("Back to the example details.");
  });
  document.getElementById("clear").addEventListener("click", function () {
    Object.keys(EXAMPLE).forEach(function (k) {
      if (typeof EXAMPLE[k] === "string" && COLORS.indexOf(k) < 0 && !CHOICES[k]) state[k] = "";
    });
    state.affiliations = [];
    state.logo_nw = state.logo_nh = 0;
    imgStatus = "none";
    fillForm();
    changed();
    setStatus("All fields cleared. Style settings are kept.");
  });

  // Links in the preview would open in this tab; the copied signature keeps them.
  sigEl.addEventListener("click", function (e) { if (e.target.closest("a")) e.preventDefault(); });

  /* ---------- copy, download, share ---------- */

  var statusTimer;
  function setStatus(msg, ok) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("ok", !!ok);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = ""; statusEl.classList.remove("ok"); }, 7000);
  }
  function flash(btn) {
    var span = btn.querySelector("span");
    btn.classList.add("done");
    span.textContent = "Copied";
    setTimeout(function () { btn.classList.remove("done"); span.textContent = btn.dataset.label; }, 2000);
  }

  // execCommand runs inside the click and can set text/html; the async Clipboard API is the second try.
  function copyWithEvent(richHtml, text) {
    var set = false;
    function onCopy(e) {
      try {
        if (richHtml) e.clipboardData.setData("text/html", richHtml);
        e.clipboardData.setData("text/plain", text);
        e.preventDefault();
        set = true;
      } catch (err) {}
    }
    document.addEventListener("copy", onCopy);
    var ran = false;
    try { ran = document.execCommand("copy"); } catch (err) {}
    document.removeEventListener("copy", onCopy);
    return ran && set;
  }
  function copy(richHtml, text) {
    if (copyWithEvent(richHtml, text)) return Promise.resolve(true);
    try {
      if (richHtml && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        return navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([richHtml], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" })
        })]).then(function () { return true; }, function () { return false; });
      }
      if (!richHtml && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
      }
    } catch (err) {}
    return Promise.resolve(false);
  }
  function selectNode(node) {
    var r = document.createRange();
    r.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  var KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘C" : "Ctrl+C";

  document.getElementById("copy-rich").addEventListener("click", function () {
    var btn = this;
    if (!html) { setStatus("Fill in the form first."); return; }
    copy(html, buildText(state)).then(function (ok) {
      if (ok) { flash(btn); setStatus("Signature copied. Paste it into your mail app's signature settings.", true); }
      else { selectNode(sigEl); setStatus("Your browser blocked copying. The signature is selected: press " + KEY + ", then paste."); }
    });
  });
  document.getElementById("copy-html").addEventListener("click", function () {
    var btn = this;
    copy(null, pretty(html)).then(function (ok) {
      if (ok) { flash(btn); setStatus("HTML code copied.", true); }
      else {
        document.getElementById("code-box").open = true;
        selectNode(codeEl);
        setStatus("Your browser blocked copying. The code is selected: press " + KEY + ".");
      }
    });
  });
  document.getElementById("copy-text").addEventListener("click", function () {
    var btn = this;
    copy(null, buildText(state)).then(function (ok) {
      if (ok) { flash(btn); setStatus("Plain-text signature copied.", true); }
      else { selectNode(sigEl); setStatus("Your browser blocked copying. The signature is selected: press " + KEY + "."); }
    });
  });

  document.getElementById("download").addEventListener("click", function () {
    if (!html) { setStatus("Fill in the form first."); return; }
    var slug = state.name.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    var doc = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>Email signature</title>\n</head>\n<body>\n' +
      pretty(html) + "\n</body>\n</html>\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html;charset=utf-8" }));
    a.download = "email-signature" + (slug ? "-" + slug : "") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    setStatus("Downloaded " + a.download + ".", true);
  });

  document.getElementById("share-brand").addEventListener("click", function () {
    var btn = this;
    var url = location.href.split("#")[0] + "#brand=" + toB64url(JSON.stringify(pick(state, BRAND)));
    var extra = state.logo_upload ? " It doesn't include the uploaded image: use an image link to share the logo." : "";
    copy(null, url).then(function (ok) {
      if (ok) { flash(btn); setStatus("Brand link copied." + extra, true); }
      else {
        codeEl.textContent = url;
        document.getElementById("code-box").open = true;
        selectNode(codeEl);
        setStatus("Your browser blocked copying. The link is selected in the code box: press " + KEY + "." + extra);
      }
    });
  });

  /* ---------- start ---------- */

  if (fromBrandLink) {
    document.getElementById("notice-text").textContent = (state.company.trim() || "Your team") +
      "'s brand settings are filled in: logo, colours, company details and disclaimer. Add your own name and contacts.";
    document.getElementById("notice").hidden = false;
    document.getElementById("intro-text").textContent = "Brand settings come from the link you opened. Fill in your own details.";
  } else if (saved) {
    document.getElementById("intro-text").textContent = "Your last details are back. They're saved only in this browser.";
  }
  document.getElementById("notice-close").addEventListener("click", function () {
    document.getElementById("notice").hidden = true;
  });

  fillForm();
  render();
  if (state.logo_type === "image" && imageSrc(state)) probeImage();
})();
