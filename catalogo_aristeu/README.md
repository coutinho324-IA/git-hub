# Catálogo de produtos — Aristeu Refrigeração

Base de produtos com fotos tratadas, gerada a partir do catálogo em PDF e das imagens enviadas (fotos e PSD).

## Lista da Loja 01 cruzada com as fotos (`lista_loja01/`)

Gerado a partir de `LISTAPRODUTO_LOJA01_ARISTEU_REFRIGERAÇÃO.xls` (3.263 produtos com saldo).

| Arquivo / pasta | Conteúdo |
|---|---|
| `lista_loja01/PRODUTOS_LOJA01_COM_IMAGENS.xlsx` | Aba **PRODUTOS**: IMAGEM (30x30) · CÓDIGO · DESCRIÇÃO · REFERÊNCIA · MARCA · INFORMAÇÕES COMPLEMENTARES · SALDO · STATUS DA FOTO · divergências. Abas **SEM FOTO (BUSCAR)** (ordenada por saldo), **DIVERGÊNCIAS**, **CATÁLOGO FORA DA LISTA**, **IMAGENS ENVIADAS** (candidatos de código para as fotos sem código), **RESUMO**, **LEIA-ME**. |
| `lista_loja01/imagens/png_transparente_1200/` | PNG transparente 1200x1200 de cada código com foto (nome = código de 6 dígitos da lista). |
| `lista_loja01/imagens/instagram_1080x1350/` | Posts para o feed, com a descrição da lista. |

Regras do cruzamento (`scripts/06_cruzar_planilha.py`): foto pelo código; se o catálogo usa o código para outra
**marca**, a foto não é usada ("FOTO NÃO CONFERE"); foto de produto equivalente só com descrição e números iguais
e mesma marca; referência e marca da lista têm prioridade (vazias são completadas pelo catálogo).

```bash
python scripts/06_cruzar_planilha.py LISTAPRODUTO_LOJA01.xls work/ work_lista/
python scripts/03_tratar_imagens.py work_lista/ fotos_enviadas/ psd_renderizados/ modelos/ saida_lista/  # _mestres ligado ao da 1ª geração
python scripts/04_posts_instagram.py work_lista/ saida_lista/ logo_aristeu.png
python scripts/07_excel_lista_completa.py work_lista/ saida_lista/ PRODUTOS_LOJA01_COM_IMAGENS.xlsx "LISTAPRODUTO_LOJA01.xls"
```

## Catálogo (1ª geração, a partir do PDF)

| Pasta / arquivo | Para que serve |
|---|---|
| `CATALOGO_PRODUTOS_ARISTEU.xlsx` | Planilha: **IMAGEM (30x30) · CÓDIGO · DESCRIÇÃO · REFERÊNCIA DO FABRICANTE · MARCA · INFORMAÇÕES COMPLEMENTARES DO FORNECEDOR**, mais categoria, nome do arquivo de imagem, post do Instagram e alertas de cadastro. |
| `imagens/png_transparente_1200/` | Uma imagem por código, 1200x1200 px, **fundo transparente** — para o site e para montar catálogo. Nome do arquivo = código do produto. |
| `imagens/instagram_1080x1350/` | Artes prontas para o feed do Instagram (4:5), uma por produto/família, com logo, códigos e WhatsApp das lojas. |
| `scripts/` | Scripts que geraram tudo (dá para rodar de novo com uma planilha nova). |

## Como as imagens foram tratadas

1. Fotos extraídas do catálogo PDF na resolução original, já com o recorte (máscara) que existia no arquivo.
2. Ampliação 4x com IA (Real-ESRGAN x4plus, rodando em ONNX/CPU).
3. Fotos sem recorte (fundo branco ou laranja): fundo removido com IA (ISNet).
4. Produto centralizado em tela quadrada 1200x1200 com fundo transparente.

As fotos do catálogo são pequenas (≈100–400 px). A IA melhora bastante a nitidez, mas textos pequenos em
etiquetas podem ficar ilegíveis. Para zoom de e-commerce acima de 1200 px, peça ao fornecedor as fotos originais.

## Pontos de atenção

- A aba **ALERTAS CADASTRO** lista códigos repetidos para produtos diferentes (ex.: 54856 usado em 3 relés COEL),
  descrições trocadas e itens sem código. Corrigir isso no sistema evita vender e comprar o item errado.
- Itens marcados **S/ CÓDIGO** precisam do código do sistema. Depois de preencher, renomeie o PNG correspondente.

## Rodar de novo

```bash
pip install pymupdf openpyxl pillow numpy onnx onnxruntime rembg psd-tools xlrd rapidfuzz
python scripts/01_extrair_catalogo.py catalogo.pdf work/
python scripts/02_base_produtos.py work/
python scripts/03_tratar_imagens.py work/ fotos_enviadas/ psd_renderizados/ modelos/ imagens/
python scripts/04_posts_instagram.py work/ imagens/ logo_aristeu.png
python scripts/05_planilha_excel.py work/ imagens/ CATALOGO_PRODUTOS_ARISTEU.xlsx
```

Modelos: `RealESRGAN_x4plus.pth` (github.com/xinntao/Real-ESRGAN, release v0.1.0) em `modelos/` e
`isnet-general-use.onnx` (baixado automaticamente pelo rembg).
