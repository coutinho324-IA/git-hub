"""Gera posts para Instagram (1080x1350, formato retrato 4:5) — um por família/foto de produto.

Uso: python 04_posts_instagram.py <WORK_DIR> <SAIDA> <LOGO_PNG>
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

WORK, SAIDA, LOGO = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
MESTRES = SAIDA / "_mestres"
OUT = SAIDA / "instagram_1080x1350"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1350
AZUL = (16, 40, 80)       # azul-marinho do logo Aristeu
VERMELHO = (232, 24, 32)  # vermelho do logo Aristeu
CINZA = (104, 120, 144)
FONTE = "/usr/share/fonts/truetype/liberation/LiberationSans-{}.ttf"


def f(tam, peso="Bold"):
    return ImageFont.truetype(FONTE.format(peso), tam)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").upper()[:60]


def quebrar(draw, texto, fonte, largura):
    linhas, atual = [], ""
    for p in texto.split():
        t = (atual + " " + p).strip()
        if draw.textlength(t, font=fonte) <= largura:
            atual = t
        else:
            linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


def titulo_do_grupo(itens):
    if len(itens) == 1:
        return itens[0]["descricao"]
    t = itens[0]["familia_titulo"]
    return {"COEL": itens[0]["descricao"], "IBBL": itens[0]["descricao"], "MG MARGIRIUS": itens[0]["descricao"],
            "THERMOSTATO": itens[0]["descricao"]}.get(t, t)


def post(itens, logo):
    base = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(base)
    # fundo: leve degradê cinza-azulado na área do produto
    for y in range(170, 900):
        c = int(255 - 14 * (y - 170) / 730)
        d.line([(0, y), (W, y)], fill=(c, c + 1 if c < 255 else 255, 255 if c + 4 > 255 else c + 4))
    # topo: logo
    lg = logo.copy()
    lg.thumbnail((250, 150), Image.LANCZOS)
    base.paste(lg, ((W - lg.width) // 2, 22), lg)
    # faixa vermelha fina
    d.rectangle([0, 176, W, 182], fill=VERMELHO)

    # produto com sombra suave
    prod = Image.open(MESTRES / itens[0]["img_mestre"]).convert("RGBA")
    caixa_w, caixa_h = 860, 640
    fator = min(caixa_w / prod.width, caixa_h / prod.height)
    prod = prod.resize((round(prod.width * fator), round(prod.height * fator)), Image.LANCZOS)
    px, py = (W - prod.width) // 2, 215 + (caixa_h - prod.height) // 2
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sombra)
    sd.ellipse([px + prod.width * 0.12, py + prod.height - 14, px + prod.width * 0.88, py + prod.height + 26],
               fill=(0, 0, 0, 70))
    sombra = sombra.filter(ImageFilter.GaussianBlur(18))
    base.paste(sombra, (0, 0), sombra)
    base.paste(prod, (px, py), prod)

    marca = next((i["marca"] for i in itens if i["marca"]), "")
    if marca:
        fm = f(26)
        tw = d.textlength(marca, font=fm)
        d.rounded_rectangle([W - tw - 70, 205, W - 34, 250], radius=22, fill=AZUL)
        d.text((W - tw - 52, 213), marca, font=fm, fill=(255, 255, 255))

    # bloco inferior azul
    d.rectangle([0, 900, W, H], fill=AZUL)
    ft = f(46)
    linhas = quebrar(d, titulo_do_grupo(itens), ft, W - 120)[:3]
    y = 935
    for ln in linhas:
        d.text((60, y), ln, font=ft, fill=(255, 255, 255))
        y += 56
    # códigos
    com_cod = [i for i in itens if i["codigo"]]
    fc = f(26, "Regular")
    y += 10
    if com_cod:
        if len(com_cod) == 1:
            txt = f"Cód. {com_cod[0]['codigo']}" + (f"  •  Ref. {com_cod[0]['ref']}" if com_cod[0]["ref"] else "")
        else:
            cods = sorted({i["codigo"] for i in com_cod}, key=int)
            if len(cods) <= 12:
                txt = f"{len(com_cod)} opções — Cód. " + ", ".join(cods)
            else:
                txt = f"{len(com_cod)} opções disponíveis (capacidades/medidas) — consulte o código pelo WhatsApp"
        for ln in quebrar(d, txt, fc, W - 120)[:2]:
            d.text((60, y), ln, font=fc, fill=(200, 212, 230))
            y += 34
    # uma linha de apoio com a informação do produto (se couber)
    info = (itens[0]["info"] or "").split(". ")[0].rstrip(".")
    if info and y < 1060:
        fi = f(25, "Regular")
        for ln in quebrar(d, info, fi, W - 120)[: 2 if y < 1030 else 1]:
            d.text((60, y + 8), ln, font=fi, fill=(160, 178, 205))
            y += 32
    # chamada para ação
    d.rounded_rectangle([60, 1140, W - 60, 1212], radius=36, fill=VERMELHO)
    cta = "PEÇA JÁ PELO WHATSAPP"
    fcta = f(34)
    d.text(((W - d.textlength(cta, font=fcta)) // 2, 1157), cta, font=fcta, fill=(255, 255, 255))
    fr = f(24, "Regular")
    lojas = ["São Francisco: (92) 98444-4694  •  São José Operário: (92) 99221-7990",
             "@aristeurefrigeracao  •  vendas1@aristeurefrigeracao.com.br"]
    y = 1245
    for ln in lojas:
        d.text(((W - d.textlength(ln, font=fr)) // 2, y), ln, font=fr, fill=(255, 255, 255))
        y += 36
    return base


def main():
    base = json.load(open(WORK / "base_produtos.json"))
    logo = Image.open(LOGO).convert("RGBA")
    grupos = {}
    for p in base:
        grupos.setdefault((p["familia"], p["img"]), []).append(p)
    for (fam, img), itens in grupos.items():
        nome = (itens[0]["codigo"] + "_" if len(itens) == 1 and itens[0]["codigo"] else "") + slug(
            titulo_do_grupo(itens))[:50]
        arq = f"{nome}.jpg"
        post(itens, logo).save(OUT / arq, quality=92, optimize=True)
        for p in itens:
            p["post_instagram"] = arq
    json.dump(base, open(WORK / "base_produtos.json", "w"), ensure_ascii=False, indent=1)
    print(f"{len(grupos)} posts em {OUT}")


if __name__ == "__main__":
    main()
