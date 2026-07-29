import os
import argparse
from pathlib import Path
from PIL import Image

def get_image_files(directory):
    """Gets all image files in a directory, sorted by name."""
    valid_exts = {'.jpg', '.jpeg', '.png', '.webp'}
    files = [f for f in os.listdir(directory) if Path(f).suffix.lower() in valid_exts]
    # Simple sort assuming names are like page_001.jpg
    files.sort()
    return [os.path.join(directory, f) for f in files]

def stitch_images(image_paths):
    """Stitches a list of images vertically into a single long strip."""
    if not image_paths:
        return None
        
    print(f"Stitching {len(image_paths)} images...")
    images = [Image.open(p) for p in image_paths]
    
    # Optional: resize all images to have the same width
    target_width = images[0].width
    resized_images = []
    
    for img in images:
        if img.width != target_width:
            aspect_ratio = img.height / img.width
            new_height = int(target_width * aspect_ratio)
            img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
        resized_images.append(img)
        
    total_height = sum(img.height for img in resized_images)
    
    stitched_img = Image.new('RGB', (target_width, total_height))
    
    current_y = 0
    for img in resized_images:
        stitched_img.paste(img, (0, current_y))
        current_y += img.height
        
    return stitched_img

def slice_image(stitched_img, output_dir, chapter_name, slice_height=1024, overlap=128):
    """Slices a long vertical image into uniform segments with overlap for training."""
    print(f"Slicing strip (Height: {stitched_img.height}) into {slice_height}px segments with {overlap}px overlap...")
    
    width, height = stitched_img.size
    
    # Calculate how much we move the window each time
    stride = slice_height - overlap
    
    current_y = 0
    slice_idx = 0
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    while current_y < height:
        # If the remaining part is smaller than slice_height, we just take the last slice_height chunk
        if current_y + slice_height > height:
            current_y = max(0, height - slice_height)
            box = (0, current_y, width, height)
            slice_img = stitched_img.crop(box)
            slice_img.save(Path(output_dir) / f"{chapter_name}_slice_{slice_idx:04d}.jpg", "JPEG", quality=95)
            break
            
        box = (0, current_y, width, current_y + slice_height)
        slice_img = stitched_img.crop(box)
        slice_img.save(Path(output_dir) / f"{chapter_name}_slice_{slice_idx:04d}.jpg", "JPEG", quality=95)
        
        current_y += stride
        slice_idx += 1

def process_chapter(chapter_dir, output_dir, slice_height, overlap):
    """Stitches and slices a single chapter."""
    chapter_name = Path(chapter_dir).name
    image_paths = get_image_files(chapter_dir)
    
    if not image_paths:
        print(f"No images found in {chapter_dir}")
        return
        
    stitched_img = stitch_images(image_paths)
    if stitched_img:
        slice_image(stitched_img, output_dir, chapter_name, slice_height, overlap)

def main():
    parser = argparse.ArgumentParser(description="Process webtoon chapters for AI training")
    parser.add_argument("input_dir", help="Directory containing chapter folders (e.g., ./dataset/mangadex/manga_id)")
    parser.add_argument("--output", "-o", default="./dataset/processed", help="Output directory for sliced images")
    parser.add_argument("--slice_height", type=int, default=1024, help="Height of each slice in pixels")
    parser.add_argument("--overlap", type=int, default=256, help="Overlap between slices in pixels to preserve context")
    
    args = parser.parse_args()
    
    input_path = Path(args.input_dir)
    
    # Check if input is a single chapter dir or a manga dir containing chapters
    has_subdirs = any(p.is_dir() for p in input_path.iterdir())
    
    if has_subdirs:
        for chapter_dir in input_path.iterdir():
            if chapter_dir.is_dir():
                print(f"\nProcessing {chapter_dir.name}...")
                process_chapter(chapter_dir, args.output, args.slice_height, args.overlap)
    else:
        # It's a single chapter directory
        process_chapter(input_path, args.output, args.slice_height, args.overlap)

if __name__ == "__main__":
    main()
