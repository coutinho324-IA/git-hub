# Catálogo de produtos — Aristeu Refrigeração

Base de produtos com fotos tratadas, gerada a partir do catálogo em PDF e das imagens enviadas (fotos e PSD).

## O que tem aqui

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
pip install pymupdf openpyxl pillow numpy onnx onnxruntime rembg psd-tools
python scripts/01_extrair_catalogo.py catalogo.pdf work/
python scripts/02_base_produtos.py work/
python scripts/03_tratar_imagens.py work/ fotos_enviadas/ psd_renderizados/ modelos/ imagens/
python scripts/04_posts_instagram.py work/ imagens/ logo_aristeu.png
python scripts/05_planilha_excel.py work/ imagens/ CATALOGO_PRODUTOS_ARISTEU.xlsx
```

Modelos: `RealESRGAN_x4plus.pth` (github.com/xinntao/Real-ESRGAN, release v0.1.0) em `modelos/` e
`isnet-general-use.onnx` (baixado automaticamente pelo rembg).
