import asyncio
import argparse
import os
import requests
from pathlib import Path
from playwright.async_api import async_playwright

async def download_image(url, filepath):
    if os.path.exists(filepath):
        print(f"Skipping {filepath} (already exists)")
        return True
    
    try:
        # Note: Depending on Cloudflare, we might need to download this using Playwright's page context
        # but for Asura, usually the CDN image URLs (e.g. ggpht.com or wp.com) are accessible directly once found.
        response = requests.get(url, stream=True, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://asuracomic.net/"
        })
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded: {filepath}")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

async def scrape_asura_chapter(chapter_url, output_dir):
    """Uses Playwright to bypass basic Cloudflare and get image URLs."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False) # Headless=False often helps with CF
        
        # Use a realistic user agent
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        
        page = await context.new_page()
        
        # We use playwright-stealth equivalent in python (if installed, or just basic evasions)
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        print(f"Navigating to {chapter_url}...")
        await page.goto(chapter_url, wait_until="domcontentloaded")
        
        # Wait for Cloudflare to pass (usually 5-10 seconds)
        print("Waiting for potential Cloudflare challenge...")
        await page.wait_for_timeout(5000)
        
        # Look for the reader area (this selector changes frequently on Asura)
        # Typically they use a container like #readerarea or similar
        print("Extracting image URLs...")
        
        # Try a few common selectors for Asura Scans
        selectors = ["#readerarea img", ".reading-content img", "img.alignnone"]
        images = []
        
        for selector in selectors:
            elements = await page.query_selector_all(selector)
            if elements:
                for el in elements:
                    src = await el.get_attribute("src")
                    if src and ("http" in src):
                        images.append(src)
                break
                
        if not images:
            print("Could not find any images. Selectors might need updating or Cloudflare blocked us.")
            await browser.close()
            return
            
        print(f"Found {len(images)} images.")
        
        chapter_name = chapter_url.strip("/").split("/")[-1]
        chapter_dir = Path(output_dir) / chapter_name
        chapter_dir.mkdir(parents=True, exist_ok=True)
        
        for i, img_url in enumerate(images):
            # Clean up URLs (sometimes they have lazy-load placeholders)
            if "data:image" in img_url:
                continue
                
            ext = img_url.split('?')[0].split('.')[-1]
            if len(ext) > 4: ext = "jpg" # fallback
            
            filepath = chapter_dir / f"page_{i+1:03d}.{ext}"
            await download_image(img_url, filepath)
            await asyncio.sleep(0.5)
            
        await browser.close()

def main():
    parser = argparse.ArgumentParser(description="Asura Scans Downloader via Playwright")
    parser.add_argument("chapter_url", help="The URL of the chapter")
    parser.add_argument("--output", "-o", default="./dataset/asura", help="Output directory")
    args = parser.parse_args()
    
    asyncio.run(scrape_asura_chapter(args.chapter_url, args.output))

if __name__ == "__main__":
    main()
