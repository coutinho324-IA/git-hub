"""Extrai produtos (código + descrição) e fotos do catálogo PDF da Aristeu Refrigeração.

Saída (em OUT_DIR):
  produtos.json          -> lista de produtos com página, posição e imagem associada
  pdf_imagens/<xref>.png -> fotos extraídas do PDF (RGBA, com a máscara de transparência original)

Uso: python 01_extrair_catalogo.py <catalogo.pdf> <OUT_DIR>
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pymupdf
from PIL import Image

PDF, OUT = Path(sys.argv[1]), Path(sys.argv[2])
IMG_DIR = OUT / "pdf_imagens"
IMG_DIR.mkdir(parents=True, exist_ok=True)

COD_RE = re.compile(r"^\s*COD\.?\s*(\d+)?\s*[-–]?\s*(.*)$", re.I)
IGNORAR = re.compile(r"DESCRIÇÃO DO PRODUTO|^Loja |^Rua |^Av\.|^Tel:|^\s*\d{5}-\d{4}|Email:|^Aplicações", re.I)


def overlap(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def extrair_imagem(doc, xref):
    """Extrai a imagem com a smask (canal alfa) aplicada, se existir."""
    dest = IMG_DIR / f"{xref}.png"
    if dest.exists():
        return dest
    pix = pymupdf.Pixmap(doc, xref)
    smask = next((i[1] for p in doc for i in p.get_images(full=True) if i[0] == xref and i[1]), 0)
    if pix.n - pix.alpha >= 4:  # CMYK -> RGB
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    if smask:
        mask = pymupdf.Pixmap(doc, smask)
        if pix.alpha:
            pix = pymupdf.Pixmap(pix, 0)
        pix = pymupdf.Pixmap(pix, mask)
    pix.save(dest)
    return dest


doc = pymupdf.open(PDF)
produtos, secoes_sem_codigo = [], []

for pno, page in enumerate(doc, start=1):
    linhas = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for ln in b["lines"]:
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if t:
                linhas.append({"bbox": ln["bbox"], "text": t, "size": max(s["size"] for s in ln["spans"])})
    linhas.sort(key=lambda l: (round(l["bbox"][1]), l["bbox"][0]))

    # Cabeçalhos de seção: fonte maior, sem "COD"
    cabecalhos = [l for l in linhas if l["size"] >= 7.0 and not COD_RE.match(l["text"]) and not IGNORAR.search(l["text"])
                  and l["bbox"][1] > 100]

    # Imagens de produto (exclui logos repetidos, cabeçalho e ícones)
    infos = page.get_image_info(xrefs=True)
    rep_xref = Counter(i["xref"] for i in infos)
    rep_dim = Counter((i["width"], i["height"]) for i in infos)
    imgs = []
    for i in infos:
        x0, y0, x1, y1 = i["bbox"]
        w, h = x1 - x0, y1 - y0
        logo = (rep_xref[i["xref"]] > 1 or (rep_dim[(i["width"], i["height"])] >= 3 and i["width"] < 200)
                or y1 < 105 or w < 22 or h < 12 or (w / max(h, 1) > 2.6 and h < 30))
        if not logo and i["xref"]:
            imgs.append({"xref": i["xref"], "bbox": i["bbox"], "area": w * h})

    # Linhas de produto (COD ...) com continuação na linha seguinte
    usadas = set()
    for idx, l in enumerate(linhas):
        m = COD_RE.match(l["text"])
        if not m:
            continue
        codigo, desc = m.group(1) or "", m.group(2).strip()
        bx0, by0, bx1, by1 = l["bbox"]
        # continuação: linha logo abaixo, mesma fonte, sem COD, alinhada
        for l2 in linhas[idx + 1:]:
            c0, c1_, c2, c3 = l2["bbox"]
            if c1_ - by1 > l["size"] * 0.9:
                break
            if c1_ < by1 - 1 or COD_RE.match(l2["text"]) or abs(l2["size"] - l["size"]) > 0.6:
                continue
            if overlap(bx0, bx1, c0, c2) > 5 and not IGNORAR.search(l2["text"]) and not re.fullmatch(r"\d{4,6}", l2["text"]):
                if l2["text"].lower().startswith(("pode ser", "a proteger")):
                    continue
                desc += " " + l2["text"].strip()
                by1 = c3
                usadas.add(id(l2))
        desc = re.sub(r"\s+", " ", desc).strip(" -")

        # Cabeçalho da seção: o mais próximo acima com sobreposição horizontal
        cab = None
        for c in cabecalhos:
            if c["bbox"][3] <= l["bbox"][1] + 2 and overlap(bx0 - 15, bx1 + 15, c["bbox"][0], c["bbox"][2]) > 0:
                if cab is None or c["bbox"][3] > cab["bbox"][3]:
                    cab = c
        topo = cab["bbox"][1] if cab else 100

        # Imagem: acima da linha, abaixo do cabeçalho, sobrepondo na horizontal
        cands = [im for im in imgs if im["bbox"][1] >= topo - 4 and (im["bbox"][1] + im["bbox"][3]) / 2 < l["bbox"][1]
                 and overlap(bx0 - 20, bx1 + 20, im["bbox"][0], im["bbox"][2]) > 0]
        if not cands:  # imagem à esquerda da lista de códigos
            cands = [im for im in imgs if im["bbox"][2] <= bx0 + 5 and im["bbox"][1] >= topo - 4
                     and im["bbox"][1] < l["bbox"][3] + 40]
        imagem = None
        if cands:
            prox = max(cands, key=lambda im: im["bbox"][3])
            faixa = [im for im in cands if im["bbox"][3] >= prox["bbox"][1] - 10]
            imagem = max(faixa, key=lambda im: im["area"])

        produtos.append({
            "pagina": pno,
            "codigo": codigo,
            "descricao": desc,
            "secao": cab["text"] if cab else "",
            "bbox": [round(v, 1) for v in l["bbox"]],
            "xref": imagem["xref"] if imagem else None,
        })

    for i in infos:  # extrai todas (o vínculo final foto<->código é feito no 02_base_produtos.py)
        if i["xref"]:
            extrair_imagem(doc, i["xref"])

json.dump(produtos, open(OUT / "produtos.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(produtos)} linhas de produto, {len({p['codigo'] for p in produtos})} códigos distintos, "
      f"{sum(1 for p in produtos if p['xref'])} com imagem")
