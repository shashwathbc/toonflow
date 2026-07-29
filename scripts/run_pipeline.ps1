param (
    [string]$MangaId,
    [string]$OutputDir = "./dataset"
)

if (-not $MangaId) {
    Write-Host "Usage: .\run_pipeline.ps1 -MangaId <uuid>"
    Write-Host "Example: .\run_pipeline.ps1 -MangaId '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0' (Solo Leveling)"
    exit
}

$RawDir = "$OutputDir/raw/mangadex/$MangaId"
$ProcessedDir = "$OutputDir/processed/$MangaId"

Write-Host "=== Webtoon Data Pipeline ==="
Write-Host "1. Installing dependencies..."
pip install -r requirements.txt
playwright install chromium

Write-Host "`n2. Downloading Manga: $MangaId ..."
python scraper/mangadex_api.py $MangaId --output "$OutputDir/raw/mangadex"

Write-Host "`n3. Processing images for AI Training (Stitch & Slice) ..."
python processing/stitch_and_slice.py $RawDir --output $ProcessedDir --slice_height 1024 --overlap 256

Write-Host "`n=== Pipeline Complete ==="
Write-Host "Processed images are available in $ProcessedDir ready for training."
