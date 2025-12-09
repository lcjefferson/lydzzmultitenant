# Problema Identificado: Tailwind CSS v4

## Situação

O projeto Next.js foi criado com **Tailwind CSS v4** (versão mais recente), que introduziu mudanças significativas na sintaxe e configuração. As classes customizadas definidas no `tailwind.config.ts` não estão sendo reconhecidas.

## Erro

```
Cannot apply unknown utility class `bg-background-primary`
Cannot apply unknown utility class `text-3xl`
```

## Causa

O Tailwind CSS v4 mudou completamente a forma como funciona:
- Não usa mais `tailwind.config.ts` da mesma forma
- Usa um novo sistema de configuração baseado em CSS
- A sintaxe `@apply` foi modificada
- Classes customizadas precisam ser definidas de forma diferente

## Soluções Possíveis

### Opção 1: Downgrade para Tailwind CSS v3 (Recomendado)

```bash
cd frontend
npm uninstall tailwindcss @tailwindcss/postcss
npm install -D tailwindcss@^3.4.0 postcss autoprefixer
npx tailwindcss init -p
```

Depois, recriar o `tailwind.config.ts` com a configuração v3.

### Opção 2: Adaptar para Tailwind CSS v4

Requer reescrever todo o `globals.css` usando a nova sintaxe do Tailwind v4:
- Remover `tailwind.config.ts`
- Definir cores e tokens diretamente no CSS
- Usar a nova sintaxe `@theme`

### Opção 3: Usar CSS Puro

Remover todas as classes customizadas do Tailwind e usar apenas CSS puro ou classes padrão do Tailwind.

## Recomendação

**Fazer downgrade para Tailwind CSS v3** é a solução mais rápida e compatível com o código já escrito. O Tailwind v4 ainda está em beta e a documentação/ecossistema ainda não está maduro.

## Status Atual

- ✅ Todas as páginas criadas
- ✅ Todos os componentes implementados
- ❌ Servidor com erro de compilação (Tailwind v4)
- 🔧 Necessário: Downgrade para Tailwind v3

## Próximos Passos

1. Fazer downgrade do Tailwind para v3
2. Reconfigurar `tailwind.config.ts`
3. Reiniciar servidor
4. Testar todas as páginas
