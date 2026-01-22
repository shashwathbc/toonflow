# Toonflow Network Access - Firewall Configuration Script
# This script adds Windows Firewall rules to allow network access to your app
# Run this script as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Toonflow Network Access Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To run as Administrator:" -ForegroundColor Yellow
    Write-Host "1. Right-click PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "3. Navigate to this folder and run: .\add-firewall-rules.ps1" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "Adding firewall rules..." -ForegroundColor Green
Write-Host ""

# Remove existing rules if they exist
$existingRules = @(
    "Toonflow Frontend (Port 8080)",
    "Toonflow Backend (Port 5050)"
)

foreach ($ruleName in $existingRules) {
    $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($rule) {
        Write-Host "Removing existing rule: $ruleName" -ForegroundColor Yellow
        Remove-NetFirewallRule -DisplayName $ruleName
    }
}

# Add Frontend rule (Port 8080)
try {
    New-NetFirewallRule -DisplayName "Toonflow Frontend (Port 8080)" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8080 `
        -Action Allow `
        -Profile Private,Public `
        -Description "Allow incoming connections to Toonflow frontend development server"
    
    Write-Host "✓ Frontend firewall rule added (Port 8080)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to add frontend rule: $($_.Exception.Message)" -ForegroundColor Red
}

# Add Backend rule (Port 5050)
try {
    New-NetFirewallRule -DisplayName "Toonflow Backend (Port 5050)" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 5050 `
        -Action Allow `
        -Profile Private,Public `
        -Description "Allow incoming connections to Toonflow backend API server"
    
    Write-Host "✓ Backend firewall rule added (Port 5050)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to add backend rule: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your app is now accessible from your phone at:" -ForegroundColor Yellow
Write-Host "  http://192.168.1.4:8080/" -ForegroundColor White
Write-Host ""
Write-Host "Make sure:" -ForegroundColor Yellow
Write-Host "  1. Your phone is on the same Wi-Fi network" -ForegroundColor White
Write-Host "  2. The dev servers are running (npm run dev)" -ForegroundColor White
Write-Host ""
pause
