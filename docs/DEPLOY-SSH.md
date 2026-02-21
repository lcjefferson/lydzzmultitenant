# Deploy e SSH

## Erro: "Permission denied, please try again"

Esse erro aparece quando o servidor **não aceita** sua autenticação SSH (senha incorreta ou chave não configurada). O `deploy.sh` precisa conseguir conectar em `root@72.60.154.65` **sem** pedir senha (para rodar em script).

### Solução recomendada: usar chave SSH

1. **Gerar uma chave (se ainda não tiver):**
   ```bash
   ssh-keygen -t ed25519 -C "deploy-lydzz" -f ~/.ssh/deploy_lydzz
   ```

2. **Colocar a chave pública no servidor** (só é possível se você ainda tiver algum acesso ao servidor — senha ou outra chave):
   ```bash
   ssh-copy-id -i ~/.ssh/deploy_lydzz.pub root@72.60.154.65
   ```
   Se o servidor só aceitar senha por enquanto, use a senha do `root` nesse comando.

3. **Testar o acesso:**
   ```bash
   ssh -i ~/.ssh/deploy_lydzz root@72.60.154.65
   ```
   Se entrar sem pedir senha, está ok.

4. **Rodar o deploy usando essa chave:**
   ```bash
   SSH_KEY=~/.ssh/deploy_lydzz ./deploy.sh
   ```

### Alternativa: usar uma chave que já existe

Se você já tem uma chave (por exemplo `~/.ssh/id_ed25519`) e ela já está no servidor:

```bash
# Ver se o ssh-agent está usando sua chave
ssh-add -l

# Se não listar sua chave, adicionar
ssh-add ~/.ssh/id_ed25519

# Testar
ssh root@72.60.154.65
```

Se o `ssh root@72.60.154.65` entrar sem pedir senha, o `./deploy.sh` também deve funcionar.

Se o servidor **só** aceitar senha e você não tiver como colocar uma chave (por exemplo, não sabe a senha de root), será preciso:
- Recuperar/resetar a senha do root no painel da VPS (DigitalOcean, AWS, etc.), ou
- Usar o console do provedor para acessar o servidor e adicionar sua chave em `~/.ssh/authorized_keys` do root.
