"""Real-ESRGAN (RRDBNet x4) em ONNX, sem PyTorch.

Lê o checkpoint oficial RealESRGAN_x4plus.pth (formato zip do torch) com um unpickler
mínimo, monta o grafo RRDBNet com onnx.helper e roda no onnxruntime (CPU).
"""
import pickle
import zipfile
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper
from PIL import Image


def carregar_pth(path):
    zf = zipfile.ZipFile(path)
    raiz = zf.namelist()[0].split("/")[0]

    class _Storage:
        def __init__(self, key, dtype):
            self.key, self.dtype = key, dtype

    def rebuild_tensor(storage, offset, size, stride, *args):
        buf = np.frombuffer(zf.read(f"{raiz}/data/{storage.key}"), dtype=storage.dtype)
        itemsize = buf.itemsize
        arr = np.lib.stride_tricks.as_strided(buf[offset:], shape=size, strides=[s * itemsize for s in stride])
        return np.array(arr)

    class Unpickler(pickle.Unpickler):
        def find_class(self, mod, name):
            if name == "_rebuild_tensor_v2":
                return rebuild_tensor
            if name == "FloatStorage":
                return np.float32
            if mod == "collections" and name == "OrderedDict":
                import collections
                return collections.OrderedDict
            return super().find_class(mod, name)

        def persistent_load(self, pid):
            _, dtype, key, *_ = pid
            return _Storage(key, dtype)

    obj = Unpickler(zf.open(f"{raiz}/data.pkl")).load()
    return obj.get("params_ema") or obj.get("params") or obj


def construir_rrdbnet(pesos, n_blocos=23):
    nodes, inits = [], []
    cont = [0]

    def nome(p):
        cont[0] += 1
        return f"{p}_{cont[0]}"

    def conv(x, chave):
        w, b = f"{chave}.weight", f"{chave}.bias"
        for k in (w, b):
            if k not in {i.name for i in inits}:
                inits.append(numpy_helper.from_array(pesos[k].astype(np.float32), k))
        y = nome("conv")
        nodes.append(helper.make_node("Conv", [x, w, b], [y], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
        return y

    def lrelu(x):
        y = nome("lrelu")
        nodes.append(helper.make_node("LeakyRelu", [x], [y], alpha=0.2))
        return y

    def concat(xs):
        y = nome("cat")
        nodes.append(helper.make_node("Concat", xs, [y], axis=1))
        return y

    escala = numpy_helper.from_array(np.array(0.2, dtype=np.float32), "k02")
    inits.append(escala)

    def res_add(x, r):  # x*0.2 + r
        m, a = nome("mul"), nome("add")
        nodes.append(helper.make_node("Mul", [x, "k02"], [m]))
        nodes.append(helper.make_node("Add", [m, r], [a]))
        return a

    def rdb(x, p):
        x1 = lrelu(conv(x, f"{p}.conv1"))
        x2 = lrelu(conv(concat([x, x1]), f"{p}.conv2"))
        x3 = lrelu(conv(concat([x, x1, x2]), f"{p}.conv3"))
        x4 = lrelu(conv(concat([x, x1, x2, x3]), f"{p}.conv4"))
        x5 = conv(concat([x, x1, x2, x3, x4]), f"{p}.conv5")
        return res_add(x5, x)

    def up2(x):
        y = nome("up")
        nodes.append(helper.make_node("Resize", [x, "", "sc2"], [y], mode="nearest"))
        return y

    inits.append(numpy_helper.from_array(np.array([1, 1, 2, 2], dtype=np.float32), "sc2"))

    feat = conv("input", "conv_first")
    x = feat
    for i in range(n_blocos):
        y = rdb(rdb(rdb(x, f"body.{i}.rdb1"), f"body.{i}.rdb2"), f"body.{i}.rdb3")
        x = res_add(y, x)
    body = conv(x, "conv_body")
    s = nome("add")
    nodes.append(helper.make_node("Add", [feat, body], [s]))
    f = lrelu(conv(up2(s), "conv_up1"))
    f = lrelu(conv(up2(f), "conv_up2"))
    out = conv(lrelu(conv(f, "conv_hr")), "conv_last")
    nodes.append(helper.make_node("Identity", [out], ["output"]))

    g = helper.make_graph(
        nodes, "rrdbnet_x4",
        [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, None, None])],
        [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 3, None, None])],
        inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid("", 13)])
    m.ir_version = 8
    return m


class Upscaler:
    def __init__(self, pth, cache_onnx):
        cache_onnx = Path(cache_onnx)
        if not cache_onnx.exists():
            onnx.save(construir_rrdbnet(carregar_pth(pth)), str(cache_onnx))
        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.sess = ort.InferenceSession(str(cache_onnx), so, providers=["CPUExecutionProvider"])

    def _rodar(self, rgb, tile=192, pad=12):
        h, w, _ = rgb.shape
        out = np.zeros((h * 4, w * 4, 3), dtype=np.float32)
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                y1, x1 = min(y0 + tile, h), min(x0 + tile, w)
                py0, px0 = max(y0 - pad, 0), max(x0 - pad, 0)
                py1, px1 = min(y1 + pad, h), min(x1 + pad, w)
                bloco = rgb[py0:py1, px0:px1].transpose(2, 0, 1)[None]
                r = self.sess.run(None, {"input": bloco})[0][0].transpose(1, 2, 0)
                out[y0 * 4:y1 * 4, x0 * 4:x1 * 4] = r[(y0 - py0) * 4:(y0 - py0 + y1 - y0) * 4,
                                                      (x0 - px0) * 4:(x0 - px0 + x1 - x0) * 4]
        return np.clip(out, 0, 1)

    def ampliar(self, im: Image.Image) -> Image.Image:
        """Amplia 4x. RGB pelo modelo; alfa por Lanczos (bordas suaves)."""
        im = im.convert("RGBA")
        arr = np.asarray(im).astype(np.float32) / 255.0
        rgb, alpha = arr[..., :3], arr[..., 3]
        # pixels transparentes costumam guardar cor lixo; preenche com branco para não "vazar" na borda
        rgb = rgb * alpha[..., None] + (1 - alpha[..., None])
        up = (self._rodar(np.ascontiguousarray(rgb)) * 255).round().astype(np.uint8)
        a = Image.fromarray((alpha * 255).astype(np.uint8)).resize((im.width * 4, im.height * 4), Image.LANCZOS)
        res = Image.fromarray(up, "RGB").convert("RGBA")
        res.putalpha(a)
        return res
