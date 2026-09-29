"""Gera uma página HTML (autocontida) para ver a lista de produtos com as fotos: busca, filtros e foto ampliada.

Uso: python 08_pagina_visualizacao.py <WORK_PLANILHA> <SAIDA_PLANILHA> <LOGO_PNG> <ARQUIVO_HTML>
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

WORK, SAIDA, LOGO, HTML = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
linhas = json.load(open(WORK / "cruzamento.json"))
base = {b["codigo"]: b for b in json.load(open(WORK / "base_produtos.json"))}
INFORMATIVOS = {"Referência vinda do catálogo", "Marca vinda do catálogo"}
STATUS = {"COM FOTO": "ok", "FOTO DE PRODUTO EQUIVALENTE": "eq", "FOTO NÃO CONFERE": "nc", "SEM FOTO": "sf"}


def webp(path, lado=480):
    im = Image.open(path).convert("RGBA")
    im.thumbnail((lado, lado), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=80, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


imagens, dados = {}, []
for l in linhas:
    b = base.get(l["codigo"], {})
    img = b.get("img_mestre")
    if img and img not in imagens:
        imagens[img] = webp(SAIDA / "_mestres" / img)
    dados.append({
        "c": l["codigo"], "d": l["descricao"], "r": l["ref"], "m": l["marca"],
        "q": l["saldo"], "s": STATUS[l["status_foto"]], "k": l["categoria"],
        "i": img or "", "f": l["info"], "dc": l["desc_catalogo"], "a": b.get("arquivo", ""),
        "p": b.get("post_instagram", ""),
        "v": [[t, a] for t, a in l["alertas"] if t not in INFORMATIVOS],
        "n": [[t, a] for t, a in l["alertas"] if t in INFORMATIVOS],
    })

logo = Image.open(LOGO).convert("RGBA")
logo.thumbnail((220, 160), Image.LANCZOS)
buf = io.BytesIO()
logo.save(buf, "PNG", optimize=True)
logo_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

pagina = (Path(__file__).with_name("08_pagina_modelo.html").read_text()
          .replace("__DADOS__", json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
          .replace("__IMAGENS__", json.dumps(imagens, separators=(",", ":")))
          .replace("__LOGO__", logo_uri))
HTML.write_text(pagina, encoding="utf-8")
print(f"{HTML}: {len(dados)} produtos, {len(imagens)} fotos, {HTML.stat().st_size / 2**20:.1f} MB")
