import requests
import time
import os
import argparse
from pathlib import Path

# MangaDex API Base URLs
API_URL = "https://api.mangadex.org"
UPLOADS_URL = "https://uploads.mangadex.org"

def download_image(url, filepath):
    """Downloads an image from a URL and saves it to the given filepath."""
    if os.path.exists(filepath):
        print(f"Skipping {filepath} (already exists)")
        return True
    
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded: {filepath}")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def get_chapters(manga_id, language="en"):
    """Fetches all chapter IDs for a given manga ID."""
    print(f"Fetching chapter list for manga {manga_id}...")
    chapters = []
    offset = 0
    limit = 100
    
    while True:
        url = f"{API_URL}/manga/{manga_id}/feed"
        params = {
            "translatedLanguage[]": [language],
            "order[chapter]": "asc",
            "limit": limit,
            "offset": offset
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        for item in data.get("data", []):
            chapter_num = item["attributes"]["chapter"]
            chapters.append({
                "id": item["id"],
                "chapter_num": chapter_num
            })
            
        if offset + limit >= data.get("total", 0):
            break
            
        offset += limit
        time.sleep(0.5) # Be nice to the API
        
    return chapters

def download_chapter(chapter_info, output_dir):
    """Downloads all images for a specific chapter."""
    chapter_id = chapter_info["id"]
    chapter_num = chapter_info["chapter_num"] or "oneshot"
    
    # Get chapter image data from the @Home server
    url = f"{API_URL}/at-home/server/{chapter_id}"
    response = requests.get(url)
    
    if response.status_code != 200:
        print(f"Failed to get server for chapter {chapter_num}. Skipping.")
        return
        
    data = response.json()
    base_url = data["baseUrl"]
    chapter_hash = data["chapter"]["hash"]
    image_list = data["chapter"]["data"]
    
    chapter_dir = Path(output_dir) / f"chapter_{chapter_num}"
    chapter_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Downloading Chapter {chapter_num} ({len(image_list)} pages)...")
    
    for i, filename in enumerate(image_list):
        # Format: base_url/data/hash/filename
        img_url = f"{base_url}/data/{chapter_hash}/{filename}"
        ext = filename.split('.')[-1]
        filepath = chapter_dir / f"page_{i+1:03d}.{ext}"
        
        success = download_image(img_url, filepath)
        
        # MangaDex requests at most 5 requests per second per IP
        time.sleep(0.3) 

def main():
    parser = argparse.ArgumentParser(description="MangaDex Downloader for AI Training")
    parser.add_argument("manga_id", help="The UUID of the manga on MangaDex")
    parser.add_argument("--output", "-o", default="./dataset/mangadex", help="Output directory")
    args = parser.parse_args()
    
    output_dir = Path(args.output) / args.manga_id
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        chapters = get_chapters(args.manga_id)
        print(f"Found {len(chapters)} chapters.")
        
        for chapter in chapters:
            download_chapter(chapter, output_dir)
            time.sleep(1) # Pause between chapters
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
