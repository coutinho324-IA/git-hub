# Busca de fotos dos produtos sem imagem (Aristeu Refrigeração)

Arquivo de entrada: `catalogo_aristeu/busca_fotos/pendentes.csv` — 3.092 produtos da Loja 01 sem foto, já em
ordem de prioridade (primeiro os que têm FABRICANTE e REFERÊNCIA, depois por SALDO).

## Objetivo

Para cada produto, **na ordem de prioridade**, encontrar e baixar **uma foto do próprio produto**
(o mesmo modelo/referência e a mesma marca). Não tratar as imagens: a remoção de fundo, a ampliação e a
geração de PNG/Excel/posts são feitas depois, na sessão principal.

## Passo 0 — teste de rede (obrigatório)

Testar com `curl -s -o /dev/null -w '%{http_code}' -L --max-time 20`:
`https://www.google.com`, `https://www.bing.com`, `https://duckduckgo.com`, `https://api.mercadolibre.com`,
`https://www.facon.com.br`.

Se todos derem 000/403 (bloqueio da política de rede): escrever o resultado em
`catalogo_aristeu/busca_fotos/STATUS.md`, fazer commit e push, mudar o título da sessão para
`BUSCA FOTOS: REDE BLOQUEADA` e parar.

## Fontes (nesta ordem de preferência)

1. Site oficial do fabricante (catálogo/produto).
2. Lojas e distribuidores grandes com página do produto (ex.: revendas de refrigeração, materiais elétricos).
3. Marketplaces (ex.: Mercado Livre).

Use o método que funcionar melhor de forma automatizada (APIs públicas de busca, páginas de busca dos sites,
`og:image` da página do produto etc.). Respeite `robots.txt` e limite as requisições (≈1 por segundo por domínio).

## Regras de aceitação (para não colocar foto errada)

- `alta`: a REFERÊNCIA do fabricante (só letras/números, com 4+ caracteres) aparece no título, na URL ou no nome do
  produto da página **e** a marca bate; ou, sem referência, a marca e **todas** as especificações numéricas da
  descrição (A, V, mm, polegadas, µF, HP, BTU, cor, tamanho) batem.
- `media`: mesma marca e mesmo tipo de produto, mas sem como confirmar o modelo exato. Baixar, mas marcar.
- Nunca aceitar foto de **outra marca**. Nunca aceitar logotipo, banner, foto de embalagem genérica ou imagem de
  categoria.
- Preferir imagens com fundo branco, a maior resolução disponível (idealmente ≥ 500 px no menor lado).
- WebP/AVIF: converter para PNG.

## Saída

- Imagens em `catalogo_aristeu/busca_fotos/originais/<CODIGO>.<ext>` (código com os 6 dígitos da planilha).
- `catalogo_aristeu/busca_fotos/resultado.csv` com as colunas:
  `codigo,status,url_imagem,url_pagina,dominio,tipo_fonte,largura,altura,titulo_pagina,observacao`
  - `status`: `encontrada_alta` | `encontrada_media` | `nao_encontrada`
  - `tipo_fonte`: `fabricante` | `revenda` | `marketplace`
  - Registrar sempre a fonte: o lojista precisa conferir o direito de uso das imagens.

## Git

- Trabalhar no branch `claude/hopeful-bardeen-eq987b`. Fazer commit e push a cada ~100 produtos processados
  (antes do push: `git pull --no-rebase origin claude/hopeful-bardeen-eq987b`).
- Alterar somente arquivos dentro de `catalogo_aristeu/busca_fotos/`. Não abrir pull request.

## Progresso

- Atualizar o título da sessão periodicamente: `BUSCA FOTOS: <processados>/3092 (<encontradas> encontradas)`.
- Ao terminar (ou se precisar parar), commit/push final e título `BUSCA FOTOS: CONCLUÍDA <processados>/3092`.
- Escrever um resumo em `catalogo_aristeu/busca_fotos/STATUS.md` (fontes que funcionaram, taxas de acerto,
  problemas encontrados).
