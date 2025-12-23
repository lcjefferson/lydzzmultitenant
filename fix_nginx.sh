#!/bin/bash

echo "==================================================="
echo "DIAGNÓSTICO E RESTART DO NGINX (HOST)"
echo "==================================================="

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, rode este script como root (sudo ./fix_nginx.sh)"
  exit 1
fi

echo "1. Verificando status atual..."
systemctl status nginx --no-pager | head -n 10

echo ""
echo "2. Verificando e Corrigindo configuração do Nginx (Proxy Pass)..."

# Define function to fix config files
fix_config_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "Verificando $file..."
        # Check if file contains proxy_pass to backend with trailing slash which strips path
        if grep -q "proxy_pass http://.*:3000/;" "$file"; then
            echo "⚠️ Encontrado proxy_pass incorreto em $file. Corrigindo..."
            # Remove the trailing slash from proxy_pass
            # Example: proxy_pass http://backend:3000/; -> proxy_pass http://backend:3000;
            sed -i 's|proxy_pass \(http://.*:3000\)/;|proxy_pass \1;|g' "$file"
            echo "✅ Arquivo corrigido."
        fi
        
        # Also check for specific backend alias if used
        if grep -q "proxy_pass http://backend/;" "$file"; then
             echo "⚠️ Encontrado proxy_pass incorreto (alias) em $file. Corrigindo..."
             sed -i 's|proxy_pass http://backend/;|proxy_pass http://backend;|g' "$file"
             echo "✅ Arquivo corrigido."
        fi
    fi
}

# Scan common Nginx config locations
if [ -d "/etc/nginx/sites-available" ]; then
    for f in /etc/nginx/sites-available/*; do
        fix_config_file "$f"
    done
fi

if [ -d "/etc/nginx/conf.d" ]; then
    for f in /etc/nginx/conf.d/*.conf; do
        fix_config_file "$f"
    done
fi

# Also check /etc/nginx/nginx.conf just in case
fix_config_file "/etc/nginx/nginx.conf"

echo ""
echo "3. Testando arquivos de configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração OK!"
    
    echo ""
    echo "3. Tentando reiniciar o Nginx..."
    systemctl restart nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reiniciado com sucesso!"
        echo "Status final:"
        systemctl is-active nginx
    else
        echo "❌ Falha ao reiniciar o Nginx. Verifique os logs: journalctl -xeu nginx"
    fi
else
    echo "❌ A configuração do Nginx tem erros (veja acima). O serviço não será reiniciado até você corrigir."
    echo "Edite o arquivo com erro (geralmente em /etc/nginx/sites-available/...) e tente novamente."
fi
