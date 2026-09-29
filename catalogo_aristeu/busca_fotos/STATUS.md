# STATUS — busca de fotos

**Situação: REDE BLOQUEADA — nenhuma busca/download foi feito.**

Teste do Passo 0 em 2026-09-29 04:07 UTC (`curl -s -o /dev/null -w '%{http_code}' -L --max-time 20`):

| URL | Resultado |
|---|---|
| https://www.google.com | 000 (proxy respondeu 403 ao CONNECT) |
| https://www.bing.com | 000 (403 no CONNECT) |
| https://duckduckgo.com | 000 (403 no CONNECT) |
| https://api.mercadolibre.com | 000 (403 no CONNECT) |
| https://www.facon.com.br | 000 (403 no CONNECT) |
| https://html.duckduckgo.com/html/ (extra) | 000 |
| https://www.decorlux.com.br (extra) | 000 |

O proxy de saída do container nega os hosts pela política de rede do ambiente
("gateway answered 403 to CONNECT (policy denial or upstream failure)").
Este container também parece ter sido criado com a política antiga.

## O que fazer

1. Nas configurações do ambiente (menu do ambiente na barra de título da sessão → Edit → Network access),
   escolher acesso total ("Full") ou adicionar os domínios necessários à lista permitida
   (buscadores, api.mercadolibre.com, sites dos fabricantes e revendas).
2. Iniciar uma **nova** sessão depois de salvar (containers já criados mantêm a política antiga)
   e repetir as instruções de `INSTRUCOES.md`.

Processados: 0/3092 · encontradas: 0.
