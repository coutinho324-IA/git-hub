"""Trata as imagens: fundo transparente + ampliação 4x (Real-ESRGAN) + enquadramento quadrado.

Saída em <SAIDA>/:
  png_transparente_1200/<CODIGO>.png  -> 1200x1200, fundo transparente (site e catálogo)
  _mestres/<fonte>.png                -> recorte em alta resolução (uso interno: Instagram/Excel)

Uso: python 03_tratar_imagens.py <WORK_DIR> <PASTA_FOTOS_USUARIO> <PASTA_PSD_RENDER> <MODELOS> <SAIDA>
"""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove
from scipy import ndimage

from esrgan_onnx import Upscaler

WORK, FOTOS, PSD, MODELOS, SAIDA = map(Path, sys.argv[1:6])
MESTRES = SAIDA / "_mestres"
AMPLIADAS = SAIDA / "_ampliadas"  # cache da ampliação 4x (etapa mais demorada)
SITE = SAIDA / "png_transparente_1200"
for d in (MESTRES, SITE, AMPLIADAS):
    d.mkdir(parents=True, exist_ok=True)

LADO, MARGEM = 1200, 0.90  # canvas 1200x1200, produto ocupa até 90%

# Recortes das imagens do catálogo que trazem 2 produtos + texto (malas FACON)
CORTES = {"48:L": (0, 0, 464, 282), "48:R": (464, 0, 928, 282), "47:L": (0, 0, 430, 290),
          "47:R": (430, 0, 886, 405), "46": (0, 0, 426, 292)}
# Camada do PSD a usar (as demais estão ocultas no arquivo)
PSD_ARQ = {"COD_58450": "COD_58450.png", "contator_01_polo": "contator_01_polo.png",
           "KTM_1000_copiar": "KTM_1000_copiar_layer2_Camada 10.png"}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").upper()[:60]


def recortar_alfa(im, limiar=10):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > limiar)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def tem_transparencia(im):
    a = np.asarray(im.convert("RGBA"))[..., 3]
    return (a < 16).mean() > 0.03


def eh_laranja(a):
    """Laranja claro das caixas atrás das malas no catálogo (~RGB 247,187,111)."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 215) & (g > 150) & (g < 215) & (b > 60) & (b < 160) & (r - b > 80)


def mascara_fundo(im, laranja=False):
    """Frente = tudo que NÃO é fundo (branco, e opcionalmente laranja) ligado à borda.

    Preserva produto claro que tenha contorno. Retorna (máscara booleana, fração da borda que é fundo).
    """
    a = np.asarray(im.convert("RGB")).astype(int)
    mn, mx = a.min(axis=2), a.max(axis=2)
    fundo_cor = (mn >= 236) & (mx - mn <= 20)
    if laranja:
        fundo_cor |= eh_laranja(a)
    borda = np.concatenate([fundo_cor[0], fundo_cor[-1], fundo_cor[:, 0], fundo_cor[:, -1]])
    rot, _ = ndimage.label(fundo_cor)
    ids = np.unique(np.concatenate([rot[0], rot[-1], rot[:, 0], rot[:, -1]]))
    fundo = np.isin(rot, ids[ids > 0])
    frente = ndimage.binary_fill_holes(~fundo)
    return frente, borda.mean()


def remover_fundo(original, ampliada, sessao, laranja=False):
    """Une a máscara da IA (ISNet) com a máscara de fundo por cor quando o fundo é liso."""
    rgb = ampliada.convert("RGB")
    ia = np.asarray(remove(rgb, session=sessao, only_mask=True, post_process_mask=True)).astype(np.float32)
    frente, frac_fundo = mascara_fundo(original, laranja)
    if frac_fundo > 0.85:
        m = Image.fromarray((frente * 255).astype(np.uint8)).resize(rgb.size, Image.LANCZOS)
        m = m.filter(ImageFilter.GaussianBlur(1.2))
        alfa = np.maximum(ia, np.asarray(m).astype(np.float32))
        metodo = "Fundo removido (IA ISNet + máscara por cor do fundo) + ampliação IA 4x"
    else:
        alfa = ia
        metodo = "Fundo removido por IA (ISNet) + ampliação IA 4x"
    if laranja:  # garante que nenhum resto da caixa laranja fique na imagem
        chave = ndimage.binary_dilation(eh_laranja(np.asarray(rgb).astype(int)), iterations=2)
        alfa[chave] = 0
    # remove fragmentos soltos (textos, sujeira) menores que 1% da maior parte do produto
    rot, n = ndimage.label(alfa > 128)
    if n > 1:
        areas = ndimage.sum(np.ones_like(alfa), rot, index=np.arange(1, n + 1))
        manter = np.isin(rot, 1 + np.flatnonzero(areas >= areas.max() * 0.01))
        alfa = alfa * ndimage.binary_dilation(manter, iterations=4)
    out = rgb.convert("RGBA")
    out.putalpha(Image.fromarray(np.clip(alfa, 0, 255).astype(np.uint8)))
    return out, metodo


def carregar(fonte):
    tipo, _, resto = fonte.partition(":")
    if tipo == "pdf":
        if "+" in resto:  # composição lado a lado (ex.: quadro fechado + aberto)
            partes = [recortar_alfa(carregar(f"pdf:{x}").convert("RGBA")) for x in resto.split("+")]
            h = max(p.height for p in partes)
            partes = [p.resize((round(p.width * h / p.height), h), Image.LANCZOS) if p.height < h * 0.6 else p
                      for p in partes]
            h = max(p.height for p in partes)
            gap = int(h * 0.08)
            tela = Image.new("RGBA", (sum(p.width for p in partes) + gap * (len(partes) - 1), h), (0, 0, 0, 0))
            x = 0
            for p in partes:
                tela.alpha_composite(p, (x, h - p.height))
                x += p.width + gap
            return tela
        xref = resto.split(":")[0]
        im = Image.open(WORK / "pdf_imagens" / f"{xref}.png").convert("RGBA")
        if resto in CORTES:
            im = im.crop(CORTES[resto])
        return im
    if tipo == "user":
        return Image.open(FOTOS / resto).convert("RGBA")
    if tipo == "psd":
        return Image.open(PSD / PSD_ARQ[resto]).convert("RGBA")
    raise ValueError(fonte)


def main():
    base = json.load(open(WORK / "base_produtos.json"))
    up = Upscaler(MODELOS / "RealESRGAN_x4plus.pth", MODELOS / "rrdbnet_x4.onnx")
    sessao = new_session("isnet-general-use")
    relatorio = {}

    fontes = sorted({p["img"] for p in base}, reverse=bool(os.environ.get("REVERSO")))
    for i, fonte in enumerate(fontes, 1):
        destino = MESTRES / f"{slug(fonte)}.png"
        if destino.with_suffix(".json").exists():
            relatorio[fonte] = json.load(open(destino.with_suffix(".json")))
            continue
        im = carregar(fonte)
        ja_transparente = tem_transparencia(im)
        # imagens muito grandes: limita a entrada para ~700 px antes do 4x
        if max(im.size) > 700:
            f = 700 / max(im.size)
            im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
        cache_up = AMPLIADAS / f"{slug(fonte)}.png"
        if cache_up.exists():
            ampliada = Image.open(cache_up)
        else:
            ampliada = up.ampliar(im)
            ampliada.save(cache_up)
        if ja_transparente:
            metodo = "Recorte original do catálogo + ampliação IA 4x"
        else:
            # malas: produto sobre caixa laranja -> laranja também é fundo
            ampliada, metodo = remover_fundo(im, ampliada, sessao, laranja=fonte[4:] in CORTES)
        # limpa ruído de alfa e recorta
        arr = np.asarray(ampliada).copy()
        arr[..., 3][arr[..., 3] < 12] = 0
        ampliada = recortar_alfa(Image.fromarray(arr, "RGBA"))
        ampliada.save(destino, optimize=True)
        info = {"metodo": metodo, "tamanho_original": list(carregar(fonte).size), "tamanho_final": list(ampliada.size)}
        json.dump(info, open(destino.with_suffix(".json"), "w"))
        relatorio[fonte] = info
        print(f"[{i}/{len(fontes)}] {fonte} -> {ampliada.size} ({metodo})", flush=True)

    # Uma imagem por código (site/catálogo): quadrado 1200x1200 transparente
    cods = {}
    for p in base:
        cods.setdefault(p["codigo"], []).append(p)
    cache = {}
    for p in base:
        if p["codigo"] and len(cods[p["codigo"]]) == 1:
            nome = p["codigo"]
        elif p["codigo"]:
            nome = f"{p['codigo']}_{slug(p['ref'] or p['descricao'])[:30]}"
        else:
            nome = f"SEM-CODIGO_{slug(p['descricao'])[:40]}"
        p["arquivo"] = f"{nome}.png"
        if p["img"] not in cache:
            m = Image.open(MESTRES / f"{slug(p['img'])}.png")
            caixa = int(LADO * MARGEM)
            f = min(caixa / m.width, caixa / m.height)
            m = m.resize((max(1, round(m.width * f)), max(1, round(m.height * f))), Image.LANCZOS)
            tela = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
            tela.alpha_composite(m, ((LADO - m.width) // 2, (LADO - m.height) // 2))
            cache[p["img"]] = tela
        cache[p["img"]].save(SITE / p["arquivo"], optimize=True)
        p["img_metodo"] = relatorio[p["img"]]["metodo"]
        p["img_original"] = relatorio[p["img"]]["tamanho_original"]
        p["img_mestre"] = f"{slug(p['img'])}.png"
    json.dump(base, open(WORK / "base_produtos.json", "w"), ensure_ascii=False, indent=1)
    print(f"{len(base)} arquivos em {SITE}")


if __name__ == "__main__":
    main()
