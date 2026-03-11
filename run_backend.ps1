# DebateMind - Start backend (clears cache first)
Write-Host "Clearing Python cache..." -ForegroundColor Yellow
Get-ChildItem -Path . -Include __pycache__ -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Starting backend..." -ForegroundColor Green
python -m uvicorn backend.main:app --reload --host 0.0.0.0
