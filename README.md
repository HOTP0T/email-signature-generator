# Email Signature Generator

**Live: https://hotp0t.github.io/email-signature-generator/**

Fill in a form, see the signature as a recipient will, and copy it into Gmail, Outlook, Apple Mail or Thunderbird. Works for any brand.

It is three static files (`index.html`, `styles.css`, `app.js`). There is no build step, no server and no tracking. Everything runs in the browser, and nothing anyone types is uploaded.

## What it does

- **Your brand:** logo or photo (image link or upload), or initials drawn in your accent colour; accent, name, details and line colours; font; text size; logo beside or above the details.
- **Your details:** name, job title, company, tagline, phone, mobile, email, website, address, WeChat ID, six social links and a button link ("Book a call →").
- **Affiliations:** up to five lines for the groups, networks or associations you belong to ("An independent member of …"), each with an optional link.
- **Disclaimer:** free text under the signature, with a standard confidentiality notice one click away.
- **Output:** copy as a ready-to-paste signature, copy the HTML, copy plain text, or download an `.html` file.
- **Checks as you type:** Gmail's 10,000-character limit, uploaded images that Gmail will remove, image links that don't load, images too small for high-resolution screens.
- **Brand link for teams:** set the logo, colours, company details and disclaimer once, then click **Copy brand link**. Anyone who opens the link gets those settings and only adds their own details. The settings travel in the link itself (`#brand=…`), so nothing is stored on a server, and personal details are never included.

The form's details are saved in the browser's local storage, so the page remembers them on the next visit.

## Why the output looks old-fashioned

Mail apps strip stylesheets, scripts and most modern CSS. The signature is built the way that survives them:

- nested tables with inline styles on every cell (classic Outlook doesn't pass fonts down from a table);
- fonts every computer has, because web fonts fall back in most mail apps;
- image width and height written out, which Outlook needs;
- logos referenced by link: Gmail removes images embedded in a signature.

An uploaded logo is never put online. The page shrinks it to 256 px at most and embeds it in the signature's HTML as a `data:` address, and keeps it in the browser's storage. Apple Mail and Outlook send it with each email; Gmail removes it, so the page asks for an image link for Gmail users.

## Run it locally

Open `index.html` in a browser. For the copy buttons to work everywhere, serve the folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish it on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After a minute the site is live at `https://<user>.github.io/<repository>/`.

## Customise

- **Example details** shown on first visit: `EXAMPLE` at the top of `app.js`.
- **Standard disclaimer:** `STANDARD_DISCLAIMER` in `app.js`.
- **Fonts on offer:** `FONTS` in `app.js` and the `<select id="f-font">` in `index.html`.
- **Social networks:** `SOCIALS` in `app.js` plus a matching input in `index.html`.
- **The tool's own look:** colour tokens at the top of `styles.css`, light and dark.

## Licence

MIT, see [LICENSE](LICENSE).
