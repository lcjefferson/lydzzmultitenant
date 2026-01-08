# deploy_via_hub.ps1
# Script Mestre para Deploy via Docker Hub

param (
    [string]$DockerUser,
    [string]$VpsHost = "72.60.154.65",
    [string]$VpsUser = "root",
    [string]$RemoteDir = "~/lydzzmultitenant"
)

# 1. Configurações Iniciais
if ([string]::IsNullOrWhiteSpace($DockerUser)) {
    $DockerUser = Read-Host "Digite seu usuário do Docker Hub"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 INICIANDO PROCESSO DE DEPLOY VIA HUB" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 2. Build e Push
Write-Host "`n[1/3] Executing Build & Push..." -ForegroundColor Yellow
./build_and_push.ps1 -DockerUser $DockerUser

if ($LASTEXITCODE -ne 0) {
    Write-Error "O processo de Build/Push falhou. Abortando deploy."
    exit 1
}

# 3. Preparar VPS
Write-Host "`n[2/3] Preparando VPS e Enviando Arquivos de Configuração..." -ForegroundColor Yellow

# Criar diretório remoto se não existir
ssh "$VpsUser@$VpsHost" "mkdir -p $RemoteDir"

# Copiar arquivos
# Enviamos: docker-compose.hub.yml, deploy_hub.sh, .env.prod (como .env)
# Não enviamos código fonte, pois as imagens já têm o código.
Write-Host "   -> Enviando docker-compose.hub.yml..."
scp docker-compose.hub.yml "$VpsUser@$VpsHost`:$RemoteDir/"

Write-Host "   -> Enviando deploy_hub.sh..."
scp deploy_hub.sh "$VpsUser@$VpsHost`:$RemoteDir/"

Write-Host "   -> Enviando nginx_vps.conf..."
scp nginx_vps.conf "$VpsUser@$VpsHost`:$RemoteDir/"

# Verificar se .env.prod existe
if (Test-Path ".env.prod") {
    Write-Host "   -> Enviando .env.prod como .env..."
    scp .env.prod "$VpsUser@$VpsHost`:$RemoteDir/.env"
} else {
    Write-Warning "Arquivo .env.prod não encontrado localmente. Certifique-se que o .env existe na VPS."
}

# Dar permissão de execução ao script remoto
ssh "$VpsUser@$VpsHost" "chmod +x $RemoteDir/deploy_hub.sh"

# 4. Executar Deploy Remoto
Write-Host "`n[3/3] Executando Deploy na VPS..." -ForegroundColor Yellow

ssh "$VpsUser@$VpsHost" "cd $RemoteDir && ./deploy_hub.sh $DockerUser"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ DEPLOY FINALIZADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "Acesse sua aplicação para verificar."
} else {
    Write-Error "`n❌ Houve um erro durante o deploy remoto."
}
