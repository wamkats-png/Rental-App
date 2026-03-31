import asyncio
import json
from playwright.async_api import async_playwright

PAGES_TO_AUDIT = [
    "/",
    "/properties",
    "/tenants",
    "/payments",
    "/maintenance",
]

async def run_usability_scan(base_url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        for path in PAGES_TO_AUDIT:
            url = base_url.rstrip("/") + path
            page = await context.new_page()
            console_errors = []
            page.on("console", lambda msg: console_errors.append(
                f"  [{msg.type.upper()}] {msg.text}"
            ) if msg.type in ("error", "warning") else None)

            print(f"\n{'='*60}")
            print(f"  AUDITING: {url}")
            print(f"{'='*60}")

            try:
                await page.goto(url, wait_until="networkidle", timeout=15000)
            except Exception as e:
                print(f"  [SKIP] Could not load page: {e}")
                await page.close()
                continue

            # ── 1. Console Errors ─────────────────────────────────────────
            await asyncio.sleep(1)  # let late console messages flush
            if console_errors:
                print(f"\n[A] Console Errors/Warnings ({len(console_errors)} found):")
                for err in console_errors:
                    print(err)
            else:
                print(f"\n[A] Console Errors: PASS — 0 errors or warnings")

            # ── 2. ARIA — Buttons missing labels ─────────────────────────
            buttons_missing = await page.eval_on_selector_all(
                "button:not([aria-label]):not([aria-labelledby])",
                "els => els.map(el => (el.innerText || '').trim() || '[EMPTY BUTTON]')"
            )
            icon_only = [b for b in buttons_missing if len(b) <= 2 or b == '[EMPTY BUTTON]']
            if icon_only:
                print(f"\n[B] ARIA — Icon-only buttons missing aria-label ({len(icon_only)}):")
                for b in icon_only:
                    print(f"  • '{b}'")
            else:
                print(f"\n[B] ARIA Labels: PASS — all icon-only buttons have labels "
                      f"(or no icon-only buttons found)")

            # ── 3. Images missing alt text ────────────────────────────────
            imgs_missing_alt = await page.eval_on_selector_all(
                "img:not([alt])",
                "els => els.map(el => el.src)"
            )
            if imgs_missing_alt:
                print(f"\n[C] Images missing alt text ({len(imgs_missing_alt)}):")
                for src in imgs_missing_alt[:5]:
                    print(f"  • {src}")
            else:
                print(f"\n[C] Image Alt Text: PASS — all <img> tags have alt attributes")

            # ── 4. Heading hierarchy ──────────────────────────────────────
            headings = await page.eval_on_selector_all(
                "h1, h2, h3, h4, h5, h6",
                "els => els.map(el => ({tag: el.tagName, text: el.innerText.trim().slice(0,60)}))"
            )
            h1s = [h for h in headings if h["tag"] == "H1"]
            print(f"\n[D] Heading Hierarchy:")
            if not h1s:
                print(f"  FAIL — No <h1> found on page")
            elif len(h1s) > 1:
                print(f"  WARN — {len(h1s)} <h1> tags found (should be 1)")
            else:
                print(f"  PASS — 1 <h1> found: \"{h1s[0]['text']}\"")
            heading_list = [h['tag'] + ': ' + h['text'] for h in headings]
            print(f"  All headings: {heading_list}")

            # ── 5. Focus management — inputs without labels ───────────────
            inputs_unlabeled = await page.eval_on_selector_all(
                "input:not([aria-label]):not([aria-labelledby]):not([id])",
                "els => els.map(el => el.outerHTML.slice(0,120))"
            )
            if inputs_unlabeled:
                print(f"\n[E] Inputs missing label association ({len(inputs_unlabeled)}):")
                for inp in inputs_unlabeled[:5]:
                    print(f"  • {inp}")
            else:
                print(f"\n[E] Input Labels: PASS — all inputs have id/aria-label")

            # ── 6. Performance timing ─────────────────────────────────────
            timing_json = await page.evaluate(
                "JSON.stringify(performance.getEntriesByType('navigation')[0])"
            )
            timing = json.loads(timing_json) if timing_json else {}
            dom_interactive = round(timing.get("domInteractive", 0))
            load_event = round(timing.get("loadEventEnd", 0))
            print(f"\n[F] Performance:")
            print(f"  DOM Interactive : {dom_interactive} ms")
            print(f"  Load Event End  : {load_event} ms")
            grade = "PASS" if load_event < 3000 else "WARN" if load_event < 5000 else "FAIL"
            print(f"  Grade           : {grade}")

            # ── 7. Meta tags ──────────────────────────────────────────────
            meta_desc = await page.query_selector("meta[name='description']")
            og_title = await page.query_selector("meta[property='og:title']")
            print(f"\n[G] SEO Meta Tags:")
            print(f"  meta[description] : {'PASS — present' if meta_desc else 'FAIL — missing'}")
            print(f"  og:title          : {'PASS — present' if og_title else 'FAIL — missing'}")

            # ── 8. Colour contrast spot check (background on body) ────────
            bg_color = await page.evaluate(
                "getComputedStyle(document.body).backgroundColor"
            )
            text_color = await page.evaluate(
                "getComputedStyle(document.body).color"
            )
            print(f"\n[H] Computed Body Colours (manual contrast verify):")
            print(f"  Background : {bg_color}")
            print(f"  Text       : {text_color}")

            await page.close()

        await browser.close()
        print(f"\n{'='*60}")
        print("  AUDIT COMPLETE")
        print(f"{'='*60}\n")

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    asyncio.run(run_usability_scan(target))
