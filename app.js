/* Email signature generator: builds an email signature as table-based HTML with inline styles,
   the only markup Gmail, Outlook and Apple Mail all keep. Everything stays in the browser. */
(function () {
  "use strict";

  var STORE = "email-signature-generator.v1";
  var GMAIL_LIMIT = 10000;
  var UPLOAD_MAX_PX = 256; // twice the widest logo the form offers
  var MAX_AFF = 5;
  var AFF_H = 24; // default height of an affiliation logo
  var AFF_MAX_W = 240;
  var AFF_MAX_H = 120;

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

  var NOTICES = {
    en: { label: "English", text: "This email and any attachments are confidential and may be legally privileged. They are intended only for the person or company they are addressed to. If you received this email by mistake, please tell the sender and delete it. Do not copy, forward or use its contents." },
    fr: { label: "Français", text: "Ce courriel et ses pièces jointes sont confidentiels et peuvent être protégés par le secret professionnel. Ils sont destinés uniquement à la personne ou à la société à laquelle ils sont adressés. Si vous avez reçu ce courriel par erreur, merci d'en informer l'expéditeur et de le supprimer. Ne le copiez pas, ne le transférez pas et n'en utilisez pas le contenu." },
    zh: { label: "中文", text: "本邮件及其附件均属机密，并可能受法律特权保护，仅供收件人（个人或公司）使用。如您误收本邮件，请告知发件人并将其删除。请勿复制、转发或使用其中任何内容。" },
    es: { label: "Español", text: "Este correo electrónico y sus archivos adjuntos son confidenciales y pueden estar protegidos por el secreto profesional. Están destinados únicamente a la persona o empresa a la que van dirigidos. Si ha recibido este correo por error, comuníqueselo al remitente y elimínelo. No copie, reenvíe ni utilice su contenido." },
    de: { label: "Deutsch", text: "Diese E-Mail und alle Anhänge sind vertraulich und können rechtlich geschützt sein. Sie sind ausschließlich für die Person oder das Unternehmen bestimmt, an die sie gerichtet sind. Wenn Sie diese E-Mail irrtümlich erhalten haben, informieren Sie bitte den Absender und löschen Sie sie. Kopieren, verbreiten oder verwenden Sie ihren Inhalt nicht." }
  };

  var PAGE_DIR = location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "");

  function newAff() {
    // w / h: size chosen in the form (0 = automatic); nw / nh: the image's own size.
    return { text: "", text_2: "", url: "", logo: "", w: 0, h: 0, lock: true, nw: 0, nh: 0 };
  }

  var EXAMPLE = {
    bilingual: false,
    bi_layout: "lines",
    lang1: "English",
    lang2: "Français",
    name: "Alex Morgan",
    name_2: "",
    title: "Head of Operations",
    title_2: "Responsable des opérations",
    company: "Northwind Studio",
    company_2: "",
    website: "https://northwind.example",
    show_site: true,
    address: "18 Harbor Street, San Francisco, CA 94111",
    address_2: "",
    tagline: "Design and print for independent brands",
    tagline_2: "Design et impression pour les marques indépendantes",
    tagline_caps: true,
    phone: "+1 415 555 0134",
    mobile: "",
    email: "alex@northwind.example",
    wechat: "",
    icons: true,
    linkedin: "https://www.linkedin.com/in/alex-morgan-example",
    x: "",
    github: "",
    instagram: "https://www.instagram.com/northwind.example",
    facebook: "",
    youtube: "",
    cta_label: "",
    cta_label_2: "",
    cta_url: "",
    affiliations: [Object.assign(newAff(), {
      text: "Founding member of the Independent Print Network",
      text_2: "Membre fondateur de l'Independent Print Network",
      logo: PAGE_DIR + "examples/affiliation-logo.png",
      h: AFF_H
    })],
    logo_type: "initials",
    logo_initials: "",
    logo_url: "",
    logo_size: 48,
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
    disclaimer: NOTICES.en.text,
    disclaimer_2: NOTICES.fr.text,
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
    bi_layout: ["lines", "columns"],
    font: Object.keys(FONTS)
  };
  var RANGES = { logo_size: [32, 128], size: [12, 15], logo_nw: [0, 100000], logo_nh: [0, 100000] };
  var COLORS = ["accent", "text", "muted", "divider_color"];
  var NUMBERS = ["logo_size", "size"];
  var LANG_KEYS = ["bilingual", "lang1", "lang2"];
  // What a brand link carries. Personal details never go into a link.
  var BRAND = ["bilingual", "bi_layout", "lang1", "lang2", "company", "company_2", "website", "address", "address_2",
    "tagline", "tagline_2", "tagline_caps", "show_site", "icons", "affiliations", "disclaimer", "disclaimer_2",
    "logo_type", "logo_initials", "logo_url", "logo_size", "logo_shape", "logo_link",
    "layout", "accent", "text", "muted", "divider", "divider_color", "font", "size"];
  var PERSONAL = ["name", "name_2", "title", "title_2", "phone", "mobile", "email", "wechat",
    "linkedin", "x", "github", "instagram", "facebook", "youtube", "cta_label", "cta_label_2", "cta_url"];

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
      return x.protocol === "https:" || x.protocol === "http:" || x.protocol === "file:" && /^file:/.test(PAGE_DIR) ? x.href : "";
    } catch (e) { return ""; }
  }
  function shortUrl(u) { return u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""); }
  function telHref(p) {
    var t = p.replace(/[^\d+]/g, "");
    return t.replace(/\D/g, "").length >= 5 ? "tel:" + t : "";
  }
  function emailOk(e) { return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e); }
  function clampInt(v, min, max) {
    v = Math.round(Number(v));
    if (!isFinite(v)) v = 0;
    return Math.min(max, Math.max(min, v));
  }

  // Contact icons are hosted PNGs (mail apps drop SVG and embedded images), one per tone below;
  // the signature uses the tone closest to the Details colour. tools/make-icons.py renders this list.
  var ICON_TONES = [
    "111111", "333333", "4d4d4d", "666666", "808080", "999999", "b3b3b3",
    "0f172a", "1e293b", "334155", "475569", "56637a", "64748b", "8792a6", "94a3b8", "aab5c7",
    "292524", "44403c", "57534e", "78716c", "a8a29e",
    "12489a", "1d4ed8", "2563eb", "0e7c66", "0f766e", "047857", "15803d", "b91c1c", "c2410c", "a16207", "7c3aed", "be185d"
  ];
  var ICON_BASE = (/^https?:$/.test(location.protocol) ? PAGE_DIR : "https://hotp0t.github.io/email-signature-generator/") + "icons/";
  function rgb(hex) {
    var n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function nearestTone(hex) {
    var a = rgb(hex), best = ICON_TONES[0], bestD = Infinity;
    ICON_TONES.forEach(function (t) {
      var b = rgb(t), rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
      var d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bestD) { bestD = d; best = t; }
    });
    return best;
  }
  // A colour moved part of the way toward another (k = 0..1), for fainter separators and small print.
  function blend(hex, toward, k) {
    var a = rgb(hex), b = rgb(toward);
    return "#" + a.map(function (v, i) { return ("0" + Math.round(v + (b[i] - v) * k).toString(16)).slice(-2); }).join("");
  }

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

  function cleanAff(a) {
    var c = newAff();
    if (!a || typeof a !== "object") return null;
    ["text", "text_2", "url", "logo"].forEach(function (f) {
      if (typeof a[f] === "string") c[f] = a[f].slice(0, f === "url" || f === "logo" ? 1000 : 300);
    });
    c.w = clampInt(a.w, 0, AFF_MAX_W);
    c.h = clampInt(a.h, 0, AFF_MAX_H);
    c.nw = clampInt(a.nw, 0, 100000);
    c.nh = clampInt(a.nh, 0, 100000);
    c.lock = a.lock !== false;
    return c;
  }

  // Keeps only known keys with the right type and range; used for storage and brand links alike.
  function clean(src) {
    var out = {};
    if (!src || typeof src !== "object") return out;
    Object.keys(EXAMPLE).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) return;
      var v = src[k], def = EXAMPLE[k];
      if (k === "affiliations") {
        if (Array.isArray(v)) out[k] = v.slice(0, MAX_AFF).map(cleanAff).filter(Boolean);
        return;
      }
      if (typeof v !== typeof def) return;
      if (CHOICES[k] && CHOICES[k].indexOf(v) < 0) return;
      if (RANGES[k]) v = clampInt(v, RANGES[k][0], RANGES[k][1]);
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

  // Size an affiliation logo is drawn at: the chosen one, completed from the image's proportions.
  function affSize(a) {
    var w = a.w, h = a.h;
    if (!w && !h) h = AFF_H;
    if (a.nw && a.nh) {
      if (!w) w = Math.round(h * a.nw / a.nh);
      if (!h) h = Math.round(w * a.nh / a.nw);
    }
    if (!h) h = AFF_H;
    return { w: Math.min(w, AFF_MAX_W), h: Math.min(h, AFF_MAX_H) };
  }

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

  /* Layout: the column beside the logo holds who you are, how to reach you, your links and the tagline.
     Affiliations and the disclaimer sit in a full-width footer under a line, so the column stays short.
     Two languages either follow each other line by line, or sit side by side in two columns. */
  // fit (side by side only): { measure } marks the columns for measuring; { l1, split, width } pin the
  // first-language column and line the footer up with it.
  function buildHtml(s, fit) {
    fit = fit || {};
    var font = FONTS[s.font] || FONTS.system;
    var ff = "font-family:" + font + ";";
    var base = s.size, lh = base + 6;
    var cols = s.bilingual && s.bi_layout === "columns";
    var border = s.divider ? "1px solid " + s.divider_color : "";
    var colLine = border ? "border-left:" + border + ";" : "";
    var GAP = '<td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>';
    var table = '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">';
    var line = "font-size:" + base + "px;line-height:" + lh + "px;color:" + s.muted + ";";
    var small = "font-size:" + (base - 1) + "px;line-height:" + (lh - 1) + "px;color:" + s.muted + ";";
    var nameStyle = "font-size:" + (base + 3) + "px;line-height:" + (base + 9) + "px;font-weight:600;color:" + s.text + ";";
    var tagStyle = "font-size:" + (base - 2) + "px;line-height:" + (base + 3) + "px;color:" + s.muted + ";" +
      (s.tagline_caps ? "letter-spacing:0.08em;" : "font-style:italic;");
    var noteStyle = "font-size:" + Math.max(10, base - 2) + "px;line-height:" + Math.max(14, base + 3) + "px;color:" + blend(s.muted, "#ffffff", 0.15) + ";";
    var sep = '<span style="color:' + blend(s.muted, "#ffffff", 0.45) + ';">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>';
    // Outlook doesn't pass the font down from a table, so every text cell names it.
    function cell(inner, style) { return '<td style="' + ff + style + '">' + inner + "</td>"; }
    function row(inner, style) { return "<tr>" + cell(inner, style) + "</tr>"; }
    function link(href, label, color, extra) {
      return '<a href="' + esc(href) + '" style="color:' + color + ";text-decoration:none;" + (extra || "") + '">' + label + "</a>";
    }
    // A small hosted icon before a phone number, WeChat ID or address; its alt / title is the hover word.
    var tone = nearestTone(s.muted), isz = base + 1;
    function icon(name, word) {
      return '<img src="' + ICON_BASE + name + "-" + tone + '.png" width="' + isz + '" height="' + isz + '" alt="' + word + '" title="' + word + '"' +
        ' style="display:inline-block;width:' + isz + "px;height:" + isz + 'px;border:0;vertical-align:-2px;margin-right:4px;">&nbsp;';
    }
    function two(k) { return s.bilingual ? s[k + "_2"].trim() : ""; }
    function tagText(t) { return esc(s.tagline_caps ? t.toLocaleUpperCase() : t); }
    var site = webUrl(s.website);
    // The company name carries the website link.
    function org(c) { return site ? link(site, esc(c), s.muted) : esc(c); }

    // The pieces, in each language where they have one.
    var name = s.name.trim(), name2 = two("name");
    var company = s.company.trim() || (site ? shortUrl(site) : "");
    var title2 = two("title"), company2 = two("company");
    var roleA = [], roleB = [];
    if (s.title.trim()) roleA.push(esc(s.title.trim()));
    if (company) roleA.push(org(company));
    if (title2) roleB.push(esc(title2));
    if (company2) roleB.push(org(company2));
    else if (cols && title2 && company) roleB.push(org(company)); // each column reads on its own

    var phones = [], reach = [];
    var phone = s.phone.trim(), mobile = s.mobile.trim(), email = s.email.trim(), wechat = s.wechat.trim();
    function tel(n) { return telHref(n) ? link(telHref(n), esc(n), s.muted) : esc(n); }
    if (phone) phones.push((s.icons ? icon("phone", "Phone") : "") + tel(phone));
    if (mobile) phones.push((s.icons ? icon("smartphone", "Mobile") : (phone ? "Mobile&nbsp;" : "")) + tel(mobile));
    if (email) reach.push(emailOk(email) ? link("mailto:" + email, esc(email), s.muted) : esc(email));
    if (wechat) reach.push((s.icons ? icon("wechat", "WeChat") : '<span style="font-weight:600;">WeChat</span>&nbsp;&nbsp;') + esc(wechat));
    var address = s.address.trim(), address2 = two("address");
    // The address icon sits in its own cell, so a second-language line lines up under the first.
    function addressBlock(lines) {
      var text = lines.map(esc).join("<br>");
      if (!s.icons) return text;
      return table + "<tr>" +
        '<td valign="top" style="padding:' + Math.round((lh - isz) / 2) + 'px 0 0;vertical-align:top;width:' + (isz + 6) + 'px;">' +
        '<img src="' + ICON_BASE + "map-pin-" + tone + '.png" width="' + isz + '" height="' + isz + '" alt="Address" title="Address" style="display:block;width:' + isz + "px;height:" + isz + 'px;border:0;"></td>' +
        cell(text, line) + "</tr></table>";
    }

    var links = SOCIALS.map(function (p) {
      var u = webUrl(s[p[0]]);
      return u ? link(u, p[1], s.accent) : "";
    }).filter(Boolean);
    if (s.show_site && site) links.unshift(link(site, esc(shortUrl(site)), s.accent, "font-weight:600;"));
    var ctaText = [s.cta_label.trim(), two("cta_label")].filter(Boolean).join(" / ");
    var ctaUrl = webUrl(s.cta_url);
    if (ctaText && ctaUrl) links.push(link(ctaUrl, esc(ctaText) + "&nbsp;&rarr;", s.accent, "font-weight:700;"));
    var tag1 = s.tagline.trim(), tag2 = two("tagline");

    var rows = [];
    function pad(px) { return rows.length && px ? "padding-top:" + px + "px;" : ""; }
    if (cols) {
      // Side by side: translated lines in two columns; untranslated and shared lines run across both.
      // Three cells: first language, a 14 px spacer, second language behind the line. The first is
      // pinned to its measured width so the split can't move with the reader's window.
      var span = function (inner, style, px) {
        rows.push('<tr><td colspan="3" style="' + ff + style + pad(px) + '">' + inner + "</td></tr>");
      };
      var pair = function (a, b, style, px) {
        if (!a || !b) { if (a || b) span(a || b, style, px); return; }
        var p = pad(px);
        rows.push("<tr>" +
          '<td valign="top"' + (fit.l1 ? ' width="' + fit.l1 + '"' : "") + (fit.measure ? " data-col1" : "") +
          ' style="' + ff + style + p + (fit.l1 ? "width:" + fit.l1 + "px;" : "") + 'vertical-align:top;">' + a + "</td>" + GAP +
          '<td valign="top"' + (fit.measure ? " data-col2" : "") + ' style="' + ff + style + p + "padding-left:14px;" + colLine + 'vertical-align:top;">' + b + "</td></tr>");
      };
      pair(name ? esc(name) : "", name2 ? esc(name2) : "", nameStyle, 0);
      pair(roleA.join(sep), roleB.join(sep), line, 0);
      pair(address ? addressBlock([address]) : "", address2 ? esc(address2) : "", line, 6);
      pair(tag1 ? tagText(tag1) : "", tag2 ? tagText(tag2) : "", tagStyle, 8);
      var shared = [phones, reach].filter(function (g) { return g.length; });
      shared.forEach(function (g, i) { span(g.join(sep), line, i === 0 ? 10 : 0); });
      if (links.length) span(links.join(sep), line, shared.length ? 8 : 10);
    } else {
      // Line by line: each line followed by its translation.
      if (name || name2) {
        rows.push(row(esc(name) + (name2 ? (name ? "&nbsp;&nbsp;" : "") + '<span style="font-weight:400;">' + esc(name2) + "</span>" : ""), nameStyle));
      }
      if (roleA.length) rows.push(row(roleA.join(sep), line));
      if (roleB.length) rows.push(row(roleB.join(sep), line));
      var contact = [];
      if (phones.length) contact.push(phones.join(sep));
      if (reach.length) contact.push(reach.join(sep));
      if (address || address2) contact.push(addressBlock([address, address2].filter(Boolean)));
      contact.forEach(function (c, i) { rows.push(row(c, line + (i === 0 ? pad(10) : ""))); });
      if (links.length) rows.push(row(links.join(sep), line + pad(contact.length ? 8 : 10)));
      [tag1, tag2].filter(Boolean).forEach(function (t, i) {
        rows.push(row(tagText(t), tagStyle + (i === 0 ? pad(8) : "")));
      });
    }

    var info = rows.length ? table + rows.join("") + "</table>" : "";
    var logo = logoHtml(s, font);
    var main;
    if (logo && info) {
      if (s.layout === "stacked") {
        main = table +
          '<tr><td style="padding:0 0 12px;">' + logo + "</td></tr>" +
          '<tr><td style="' + (border ? "padding:12px 0 0;border-top:" + border + ";" : "padding:0;") + '">' + info + "</td></tr></table>";
      } else {
        main = table + "<tr>" +
          '<td valign="top" style="padding:2px ' + (border ? 16 : 18) + 'px 0 0;vertical-align:top;">' + logo + "</td>" +
          '<td valign="top" style="' + (border ? "padding:0 0 0 16px;border-left:" + border + ";" : "padding:0;") + 'vertical-align:top;">' + info + "</td>" +
          "</tr></table>";
      }
    } else {
      main = logo || info;
    }
    if (fit.measure) return '<div data-main style="display:inline-block;">' + main + "</div>";

    // Footer: affiliations, then the disclaimer in each language.
    var items = s.affiliations.map(function (a) {
      return { t1: a.text.trim(), t2: s.bilingual ? a.text_2.trim() : "", url: webUrl(a.url), logo: webUrl(a.logo), size: affSize(a) };
    }).filter(function (it) { return it.t1 || it.t2 || it.logo; });
    var blocks = [];
    items.forEach(function (it) {
      var logoOnly = it.logo && !it.t1 && !it.t2;
      var last = blocks[blocks.length - 1];
      if (logoOnly && last && last.logos) last.logos.push(it);
      else blocks.push(logoOnly ? { logos: [it] } : { item: it });
    });
    function affLogo(it) {
      var sz = it.size;
      var img = '<img src="' + esc(it.logo) + '"' + (sz.w ? ' width="' + sz.w + '"' : "") + ' height="' + sz.h + '"' +
        ' alt="' + esc(it.t1 || it.t2 || "Affiliation") + '" style="display:block;' + (sz.w ? "width:" + sz.w + "px;" : "width:auto;") +
        "height:" + sz.h + 'px;border:0;outline:none;">';
      return it.url ? '<a href="' + esc(it.url) + '" style="text-decoration:none;">' + img + "</a>" : img;
    }
    function affText(it, t) { return it.url ? link(it.url, esc(t), s.muted, "text-decoration:underline;") : esc(t); }
    function affWords(it) {
      return [it.t1, it.t2].filter(Boolean).map(function (t) { return affText(it, t); }).join("<br>");
    }
    function withLogo(it, words) {
      if (!it.logo) return table + row(words, small) + "</table>";
      return table + "<tr>" +
        '<td valign="middle" style="padding:0 10px 0 0;vertical-align:middle;">' + affLogo(it) + "</td>" +
        cell(words, small + "vertical-align:middle;") + "</tr></table>";
    }
    function note(t) { return esc(t).replace(/\r?\n/g, "<br>"); }

    var foot = [];
    function footRow(inner, px, style) {
      foot.push("<tr><td" + (cols ? ' colspan="3"' : "") + ' style="' + (style ? ff + style : "") +
        "padding:" + (foot.length ? px : 0) + 'px 0 0;">' + inner + "</td></tr>");
    }
    // The footer's first column ends where the main block's does, so the two lines meet the same split.
    var leftW = fit.split ? Math.max(60, Math.round(fit.split) - 14) : 0;
    function footPair(a, b, px, style, v) {
      var p = foot.length ? px : 0;
      foot.push("<tr>" +
        '<td valign="' + v + '"' + (leftW ? ' width="' + leftW + '"' : "") + ' style="' + ff + style + (leftW ? "width:" + leftW + "px;" : "") +
        "padding-top:" + p + "px;vertical-align:" + v + ';">' + a + "</td>" + GAP +
        '<td valign="' + v + '" style="' + ff + style + "padding:" + p + "px 0 0 14px;" + colLine + "vertical-align:" + v + ';">' + b + "</td></tr>");
    }
    blocks.forEach(function (b) {
      if (b.logos) {
        footRow(table + "<tr>" + b.logos.map(function (it, i) {
          return '<td valign="middle" style="padding:0 ' + (i < b.logos.length - 1 ? 16 : 0) + 'px 0 0;vertical-align:middle;">' + affLogo(it) + "</td>";
        }).join("") + "</tr></table>", 8);
      } else if (cols && b.item.t1 && b.item.t2) {
        footPair(withLogo(b.item, affText(b.item, b.item.t1)), affText(b.item, b.item.t2), 8, small, "middle");
      } else {
        footRow(withLogo(b.item, affWords(b.item)), 8);
      }
    });
    var d1 = s.disclaimer.trim(), d2 = two("disclaimer");
    if (cols && d1 && d2) footPair(note(d1), note(d2), 12, noteStyle, "top");
    else [d1, d2].filter(Boolean).forEach(function (t, i) { footRow(note(t), i === 0 ? 12 : 8, noteStyle); });
    if (!foot.length) return main;

    var footer = '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;max-width:' + (cols ? (fit.width ? Math.max(560, Math.round(fit.width)) : 640) : 520) + 'px;">' +
      '<tr><td style="' + (border ? "padding:12px 0 0;border-top:" + border + ";" : "padding:0;") + '">' +
      table + foot.join("") + "</table></td></tr></table>";
    if (!main) return footer;
    return table + '<tr><td style="padding:0;">' + main + "</td></tr>" +
      '<tr><td style="padding:18px 0 0;">' + footer + "</td></tr></table>";
  }

  function buildText(s) {
    var out = [];
    function two(k) { return s.bilingual ? s[k + "_2"].trim() : ""; }
    function add(v) { if (v) out.push(v); }
    var site = webUrl(s.website);
    add([s.name.trim(), two("name")].filter(Boolean).join("  "));
    add([s.title.trim(), s.company.trim()].filter(Boolean).join(" · "));
    add([two("title"), two("company")].filter(Boolean).join(" · "));
    var phones = [], reach = [];
    if (s.phone.trim()) phones.push("Phone " + s.phone.trim());
    if (s.mobile.trim()) phones.push("Mobile " + s.mobile.trim());
    if (s.email.trim()) reach.push(s.email.trim());
    if (s.wechat.trim()) reach.push("WeChat " + s.wechat.trim());
    add(phones.join(" · "));
    add(reach.join(" · "));
    add(s.address.trim());
    add(two("address"));
    if (site) add(shortUrl(site));
    SOCIALS.forEach(function (p) { var u = webUrl(s[p[0]]); if (u) add(p[1] + ": " + u); });
    var ctaText = [s.cta_label.trim(), two("cta_label")].filter(Boolean).join(" / "), ctaUrl = webUrl(s.cta_url);
    if (ctaText && ctaUrl) add(ctaText + ": " + ctaUrl);
    add(s.tagline.trim());
    add(two("tagline"));

    var blocks = [out.join("\n")];
    var affs = [];
    s.affiliations.forEach(function (a) {
      var u = webUrl(a.url), lines = [a.text.trim(), s.bilingual ? a.text_2.trim() : ""].filter(Boolean);
      if (lines.length) affs.push(lines.join("\n") + (u ? " (" + shortUrl(u) + ")" : ""));
    });
    if (affs.length) blocks.push(affs.join("\n"));
    blocks.push(s.disclaimer.trim(), two("disclaimer"));
    return blocks.filter(Boolean).join("\n\n");
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
  // Fields added after someone saved (or shared) their settings start empty, never with example text.
  function blankMissing(src, keys) {
    keys.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(src, k)) return;
      if (k === "affiliations") state.affiliations = [];
      else if (/_2$/.test(k)) state[k] = "";
    });
  }

  var saved = readSaved();
  var brand = readBrandHash();
  var state = Object.assign(freshExample(), saved || {});
  if (saved) blankMissing(saved, Object.keys(EXAMPLE));
  var fromBrandLink = false;
  if (brand) {
    if (!saved) PERSONAL.forEach(function (k) { state[k] = ""; });
    Object.assign(state, brand);
    blankMissing(brand, BRAND);
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
  var affStatus = {};     // image link -> loading | ok | error

  var ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    linked: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>',
    unlinked: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };

  function langInput(i, field, label, placeholder, type) {
    var id = "f-aff-" + i + "-" + field;
    return '<input id="' + id + '" type="' + (type || "text") + '" data-aff="' + i + '" data-field="' + field + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") + (label ? ' data-label="' + esc(label) + '"' : "") +
      ' value="' + esc(state.affiliations[i][field]) + '">';
  }

  // Rebuilt only when rows are added or removed, so typing never loses focus.
  function renderAffRows() {
    affList.innerHTML = state.affiliations.map(function (a, i) {
      var n = i + 1;
      return '<div class="aff-row">' +
        '<div class="aff-head"><span class="aff-title">Affiliation ' + n + "</span>" +
        '<button type="button" class="icon-btn small" data-aff-remove="' + i + '" aria-label="Remove affiliation ' + n + '">' + ICON.x + "</button></div>" +
        '<div class="field"><label for="f-aff-' + i + '-text">Text <span class="opt">optional</span></label><div class="pair">' +
        '<div class="li"><span class="lang-tag" data-lang="1"></span>' + langInput(i, "text", "", "e.g. An independent member of …") + "</div>" +
        '<div class="li" data-when="bilingual=true"><span class="lang-tag" data-lang="2"></span>' + langInput(i, "text_2", "Affiliation " + n + " text") + "</div>" +
        "</div></div>" +
        '<div class="row2">' +
        '<div class="field"><label for="f-aff-' + i + '-url">Link <span class="opt">optional</span></label>' + langInput(i, "url", "", "https://…", "url") + "</div>" +
        '<div class="field"><label for="f-aff-' + i + '-logo">Logo image link <span class="opt">optional</span></label>' + langInput(i, "logo", "", "https://…/logo.png", "url") + "</div>" +
        "</div>" +
        '<div class="aff-size" data-aff-size="' + i + '">' +
        '<span class="field-label">Logo size</span>' +
        '<div class="size-inputs">' +
        '<label class="num" for="f-aff-' + i + '-w"><span>W</span><input id="f-aff-' + i + '-w" type="number" min="0" max="' + AFF_MAX_W + '" inputmode="numeric" data-aff="' + i + '" data-field="w" aria-label="Logo width in pixels"></label>' +
        '<button type="button" class="icon-btn lock" data-aff-lock="' + i + '"></button>' +
        '<label class="num" for="f-aff-' + i + '-h"><span>H</span><input id="f-aff-' + i + '-h" type="number" min="0" max="' + AFF_MAX_H + '" inputmode="numeric" data-aff="' + i + '" data-field="h" aria-label="Logo height in pixels"></label>' +
        '<span class="unit">px</span>' +
        '<span class="hint native" data-aff-native="' + i + '"></span>' +
        "</div></div>" +
        "</div>";
    }).join("");
    affAdd.hidden = state.affiliations.length >= MAX_AFF;
    state.affiliations.forEach(function (_, i) { updateAffUI(i); });
    syncLanguageUI();
    syncVisibility();
  }

  function updateAffUI(i) {
    var a = state.affiliations[i];
    if (!a) return;
    var box = affList.querySelector('[data-aff-size="' + i + '"]');
    if (box) box.hidden = !a.logo.trim();
    var sz = affSize(a);
    ["w", "h"].forEach(function (f) {
      var inp = document.getElementById("f-aff-" + i + "-" + f);
      if (inp && document.activeElement !== inp) inp.value = sz[f] || "";
    });
    var nat = affList.querySelector('[data-aff-native="' + i + '"]');
    if (nat) nat.textContent = a.nw && a.nh ? "Image is " + a.nw + " × " + a.nh + " px" : "";
    var lock = affList.querySelector('[data-aff-lock="' + i + '"]');
    if (lock) {
      lock.setAttribute("aria-pressed", a.lock ? "true" : "false");
      lock.setAttribute("aria-label", "Keep proportions");
      lock.title = a.lock ? "Proportions kept. Click to set width and height separately." : "Click to keep the image's proportions.";
      lock.innerHTML = a.lock ? ICON.linked : ICON.unlinked;
    }
  }

  function syncLanguageUI() {
    form.classList.toggle("bi", !!state.bilingual);
    var n1 = state.lang1.trim() || "First", n2 = state.lang2.trim() || "Second";
    Array.prototype.forEach.call(form.querySelectorAll(".lang-tag"), function (el) {
      el.textContent = el.getAttribute("data-lang") === "2" ? n2 : n1;
      el.title = el.textContent;
    });
    Array.prototype.forEach.call(form.querySelectorAll("[data-label]"), function (el) {
      el.setAttribute("aria-label", el.getAttribute("data-label") + " (" + n2 + ")");
    });
  }

  function syncVisibility() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-when]"), function (el) {
      var m = el.getAttribute("data-when").match(/^(\w+)(!?=)(\w+)$/);
      if (!m) return;
      var v = String(state[m[1]]);
      el.hidden = m[2] === "=" ? v !== m[3] : v === m[3];
    });
    document.getElementById("size-out").textContent = state.logo_size + " px";
    document.getElementById("upload-chip").hidden = !state.logo_upload;
    document.getElementById("upload-hint").hidden = !!state.logo_upload;
    document.getElementById("upload-name").textContent = state.logo_upload ? (state.logo_upload_name || "Uploaded image") + ", used instead of the link" : "";
  }

  function fillForm() {
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
    renderAffRows();
  }

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
    s.affiliations.forEach(function (a, i) {
      var raw = a.logo.trim(), n = "Affiliation " + (i + 1) + ": ";
      if (!raw) return;
      var u = webUrl(raw);
      if (!u) { w.push(["warn", n + "the logo link isn't a web address. It should start with https://."]); return; }
      if (affStatus[u] === "error") w.push(["warn", n + "the logo didn't load. Check that the link opens the image itself and that anyone can open it."]);
      else if (/^http:/i.test(raw)) w.push(["warn", n + "use an https:// link for the logo. Some mail apps block images sent over http."]);
      var sz = affSize(a);
      if (a.nw && sz.w && a.nw < sz.w * 2) w.push(["info", n + "the logo image is " + a.nw + " px wide. Shown " + sz.w + " px wide, it needs " + (sz.w * 2) + " px to stay sharp on high-resolution screens."]);
    });
    if (s.email.trim() && !emailOk(s.email.trim())) w.push(["info", "The email address looks incomplete, so it isn't a link yet."]);
    if (html.length > GMAIL_LIMIT) {
      w.push(["warn", "Gmail accepts signatures up to 10,000 characters and this one is " + html.length.toLocaleString("en-US") + "." +
        (s.logo_upload ? " The uploaded image takes most of it; an image link fixes this." : "")]);
    }
    return w;
  }

  // Side by side: lay the main block out off-screen at a comfortable width and read where the
  // second language starts, so the footer's columns can follow it.
  var measureBox = document.createElement("div");
  measureBox.setAttribute("aria-hidden", "true");
  measureBox.style.cssText = "position:absolute;left:-10000px;top:0;width:900px;visibility:hidden;pointer-events:none;";
  document.body.appendChild(measureBox);
  function measureColumns(s) {
    measureBox.innerHTML = buildHtml(s, { measure: true });
    var root = measureBox.querySelector("[data-main]");
    var col1 = measureBox.querySelector("[data-col1]"), col2 = measureBox.querySelector("[data-col2]");
    var fit = {};
    if (root && col1 && col2) {
      var left = root.getBoundingClientRect().left, x2 = col2.getBoundingClientRect().left;
      fit = {
        l1: Math.round(x2 - 14 - col1.getBoundingClientRect().left), // first-language column, spacer excluded
        split: Math.round(x2 - left),                                  // where the line sits, from the signature's left edge
        width: root.getBoundingClientRect().width
      };
    }
    measureBox.innerHTML = "";
    return fit;
  }

  function render() {
    var cols = state.bilingual && state.bi_layout === "columns";
    html = buildHtml(state, cols ? measureColumns(state) : null);
    // Laid out at its natural width like in a desktop mail window, then shrunk to fit the preview if wider.
    sigEl.classList.toggle("natural", cols);
    sigEl.innerHTML = html || '<p class="sig-empty">Your signature appears here once you fill in the form.</p>';
    fitPreview();
    codeEl.textContent = pretty(html);

    var n = html.length;
    document.getElementById("meter").classList.toggle("over", n > GMAIL_LIMIT);
    document.getElementById("meter-text").textContent = n.toLocaleString("en-US") + " of " + GMAIL_LIMIT.toLocaleString("en-US") + " characters";
    document.getElementById("meter-fill").style.width = Math.min(100, n / GMAIL_LIMIT * 100) + "%";

    warningsEl.innerHTML = warningsFor(state).map(function (w) {
      return '<li class="' + w[0] + '">' + ICON[w[0]] + "<span>" + esc(w[1]) + "</span></li>";
    }).join("");
  }

  var pvSub = document.getElementById("pv-sub");
  function fitPreview() {
    sigEl.style.zoom = "";
    var avail = sigEl.parentNode.clientWidth, natural = sigEl.offsetWidth, label = "As a recipient sees it";
    if (sigEl.classList.contains("natural") && avail > 0 && natural > avail) {
      var z = Math.floor(avail / natural * 1000) / 1000;
      sigEl.style.zoom = String(z);
      label = "Shown at " + Math.round(z * 100) + "% to fit";
    }
    pvSub.textContent = label;
  }
  window.addEventListener("resize", fitPreview);

  var savedTimer;
  function changed() {
    render();
    if (save()) {
      savedEl.textContent = "Saved in this browser.";
      clearTimeout(savedTimer);
      savedTimer = setTimeout(function () { savedEl.textContent = ""; }, 2000);
    }
  }

  // Reads each image once to learn its proportions, so the HTML can carry an exact size (Outlook needs it).
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

  var affTimer;
  function probeAffLogos() {
    state.affiliations.forEach(function (a) {
      var u = webUrl(a.logo);
      if (!u || (a.nw && a.nh) || affStatus[u] === "loading") return;
      affStatus[u] = "loading";
      var im = new Image();
      im.onload = function () {
        affStatus[u] = "ok";
        state.affiliations = state.affiliations.map(function (x) {
          return webUrl(x.logo) === u ? Object.assign({}, x, { nw: im.naturalWidth, nh: im.naturalHeight }) : x;
        });
        state.affiliations.forEach(function (_, i) { updateAffUI(i); });
        changed();
      };
      im.onerror = function () { affStatus[u] = "error"; changed(); };
      im.src = u;
    });
  }
  function scheduleAffProbe() {
    clearTimeout(affTimer);
    affTimer = setTimeout(probeAffLogos, 400);
  }

  function onAffField(el) {
    var i = Number(el.dataset.aff), f = el.dataset.field, a = state.affiliations[i];
    if (!a) return;
    var c = Object.assign({}, a);
    if (f === "w" || f === "h") {
      var n = clampInt(el.value, 0, f === "w" ? AFF_MAX_W : AFF_MAX_H);
      if (n === a[f]) return;
      c[f] = n;
      if (c.lock && c.nw && c.nh && n) {
        if (f === "w") c.h = Math.min(AFF_MAX_H, Math.round(n * c.nh / c.nw));
        else c.w = Math.min(AFF_MAX_W, Math.round(n * c.nw / c.nh));
      }
    } else {
      if (el.value === a[f]) return;
      c[f] = el.value;
      if (f === "logo") { c.nw = c.nh = 0; scheduleAffProbe(); }
    }
    state.affiliations = state.affiliations.map(function (x, j) { return j === i ? c : x; });
    updateAffUI(i);
    changed();
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
    if (el.dataset && el.dataset.aff !== undefined) { onAffField(el); return; }
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
    if (LANG_KEYS.indexOf(k) >= 0) syncLanguageUI();
    syncVisibility();
    changed();
  }
  form.addEventListener("input", onField);
  form.addEventListener("change", onField);
  form.addEventListener("focusout", function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.hexFor) el.value = state[el.dataset.hexFor].toUpperCase();
    if (el.dataset && el.dataset.aff !== undefined && (el.dataset.field === "w" || el.dataset.field === "h")) updateAffUI(Number(el.dataset.aff));
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
    state.affiliations = state.affiliations.concat([newAff()]);
    renderAffRows();
    changed();
    document.getElementById("f-aff-" + (state.affiliations.length - 1) + "-text").focus();
  });
  affList.addEventListener("click", function (e) {
    var rm = e.target.closest("[data-aff-remove]");
    if (rm) {
      var i = Number(rm.getAttribute("data-aff-remove"));
      state.affiliations = state.affiliations.filter(function (_, j) { return j !== i; });
      renderAffRows();
      changed();
      var next = state.affiliations.length ? document.getElementById("f-aff-" + Math.min(i, state.affiliations.length - 1) + "-text") : affAdd;
      next.focus();
      return;
    }
    var lk = e.target.closest("[data-aff-lock]");
    if (lk) {
      var k = Number(lk.getAttribute("data-aff-lock"));
      state.affiliations = state.affiliations.map(function (a, j) {
        if (j !== k) return a;
        var c = Object.assign({}, a), sz = affSize(a);
        c.lock = !a.lock;
        // Unlocking fixes the current size; locking again follows the image's proportions from the height.
        if (!c.lock) { c.w = sz.w; c.h = sz.h; }
        else if (c.nw && c.nh) { c.h = sz.h; c.w = Math.min(AFF_MAX_W, Math.round(sz.h * c.nw / c.nh)); }
        return c;
      });
      updateAffUI(k);
      changed();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll(".std[data-target]"), function (box) {
    var target = box.getAttribute("data-target");
    box.innerHTML = '<span class="hint">Standard notice:</span>' + Object.keys(NOTICES).map(function (k) {
      return '<button type="button" class="linkbtn" data-std="' + k + '" lang="' + k + '">' + NOTICES[k].label + "</button>";
    }).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-std]");
      if (!b) return;
      state[target] = NOTICES[b.getAttribute("data-std")].text;
      form.elements[target].value = state[target];
      changed();
    });
  });

  document.getElementById("reset").addEventListener("click", function () {
    state = freshExample();
    imgStatus = "none";
    fillForm();
    changed();
    probeAffLogos();
    setStatus("Back to the example details.");
  });
  document.getElementById("clear").addEventListener("click", function () {
    Object.keys(EXAMPLE).forEach(function (k) {
      if (typeof EXAMPLE[k] === "string" && COLORS.indexOf(k) < 0 && !CHOICES[k] && k !== "lang1" && k !== "lang2") state[k] = "";
    });
    state.affiliations = [];
    state.logo_nw = state.logo_nh = 0;
    imgStatus = "none";
    fillForm();
    changed();
    setStatus("All fields cleared. Style and language settings are kept.");
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
      "'s brand settings are filled in: languages, company details, affiliations, logo, style and disclaimer. Add your own name and contacts.";
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
  probeAffLogos();
})();
