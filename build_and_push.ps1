# build_and_push.ps1
param (
    [string]$DockerUser,
    [string]$Tag = "latest"
)

# 1. Configurar Usuário do Docker Hub
if ([string]::IsNullOrWhiteSpace($DockerUser)) {
    $DockerUser = Read-Host "Digite seu usuário do Docker Hub"
}

if ([string]::IsNullOrWhiteSpace($DockerUser)) {
    Write-Error "Usuário do Docker Hub é obrigatório."
    exit 1
}

Write-Host "🐳 Usando Docker User: $DockerUser" -ForegroundColor Cyan

# 2. Carregar variáveis do .env.prod para o build do Frontend
if (-not (Test-Path ".env.prod")) {
    Write-Error "Arquivo .env.prod não encontrado! É necessário para as variáveis NEXT_PUBLIC."
    exit 1
}

# Lendo variáveis específicas
$envContent = Get-Content .env.prod
$apiUrl = $null
$wsUrl = $null

foreach ($line in $envContent) {
    if ($line -match "^NEXT_PUBLIC_API_URL=(.*)") { $apiUrl = $matches[1] }
    if ($line -match "^NEXT_PUBLIC_WS_URL=(.*)") { $wsUrl = $matches[1] }
}

if ([string]::IsNullOrWhiteSpace($apiUrl) -or [string]::IsNullOrWhiteSpace($wsUrl)) {
    Write-Warning "⚠️ Não foi possível encontrar NEXT_PUBLIC_API_URL ou NEXT_PUBLIC_WS_URL no .env.prod."
    $apiUrl = Read-Host "Digite o valor para NEXT_PUBLIC_API_URL (ex: https://api.seudominio.com)"
    $wsUrl = Read-Host "Digite o valor para NEXT_PUBLIC_WS_URL (ex: https://api.seudominio.com)"
}

Write-Host "🔧 Frontend Build Args:" -ForegroundColor Gray
Write-Host "   API_URL: $apiUrl" -ForegroundColor Gray
Write-Host "   WS_URL:  $wsUrl" -ForegroundColor Gray

# 3. Login no Docker Hub
Write-Host "🔑 Realizando login no Docker Hub..." -ForegroundColor Yellow
docker login

# 4. Build & Push Backend
Write-Host "🏗️  Construindo imagem do Backend..." -ForegroundColor Yellow
docker build -t "$DockerUser/lydzz-backend:$Tag" -f backend/Dockerfile ./backend
if ($LASTEXITCODE -ne 0) { Write-Error "Falha no build do backend"; exit 1 }

Write-Host "⬆️  Enviando backend para o Docker Hub..." -ForegroundColor Yellow
docker push "$DockerUser/lydzz-backend:$Tag"
if ($LASTEXITCODE -ne 0) { Write-Error "Falha no push do backend"; exit 1 }

# 5. Build & Push Frontend
Write-Host "🏗️  Construindo imagem do Frontend..." -ForegroundColor Yellow
docker build `
    --build-arg NEXT_PUBLIC_API_URL=$apiUrl `
    --build-arg NEXT_PUBLIC_WS_URL=$wsUrl `
    -t "$DockerUser/lydzz-frontend:$Tag" `
    -f frontend/Dockerfile ./frontend
if ($LASTEXITCODE -ne 0) { Write-Error "Falha no build do frontend"; exit 1 }

Write-Host "⬆️  Enviando frontend para o Docker Hub..." -ForegroundColor Yellow
docker push "$DockerUser/lydzz-frontend:$Tag"
if ($LASTEXITCODE -ne 0) { Write-Error "Falha no push do frontend"; exit 1 }

Write-Host "✅ Build e Push concluídos com sucesso!" -ForegroundColor Green
Write-Host "Imagem Backend: $DockerUser/lydzz-backend:$Tag"
Write-Host "Imagem Frontend: $DockerUser/lydzz-frontend:$Tag"
