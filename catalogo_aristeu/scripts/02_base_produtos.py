"""Monta a base de produtos: família, foto, marca, referência, informações complementares e alertas.

Entrada: produtos.json (saída do 01_extrair_catalogo.py)
Saída:   base_produtos.json

O vínculo foto <-> código foi conferido visualmente página a página no catálogo.
Uso: python 02_base_produtos.py <WORK_DIR>
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

WORK = Path(sys.argv[1])
linhas = json.load(open(WORK / "produtos.json"))

# ---------------------------------------------------------------------------
# Famílias de produto (seções do catálogo)
#   img:    fonte da foto  ("pdf:<xref>", "pdf:<xref>:L|R" = metade, "pdf:a+b" = composição)
#   codes:  códigos da família; (codigo, trecho_da_descricao) quando o mesmo código aparece em 2 produtos
#   prefixo: prefixo aplicado quando a linha do catálogo não traz o nome do produto
# ---------------------------------------------------------------------------
F = []


def fam(fid, titulo, img, codes, categoria, marca="", info="", prefixo="", ref=None, pagina=None, imgs=None):
    F.append(dict(id=fid, titulo=titulo, img=img, codes=codes, categoria=categoria, marca=marca, info=info,
                  prefixo=prefixo, ref=ref, pagina=pagina, imgs=imgs or {}))


CAT_EPI = "EPI / Segurança"
CAT_ELE = "Elétrica / Comandos"
CAT_CAP = "Capacitores"
CAT_REF = "Refrigeração / Componentes"
CAT_INS = "Instalação de Ar-Condicionado"
CAT_QUI = "Químicos / Solda e Vedação"
CAT_FER = "Ferramentas / Instrumentos"
CAT_COEL = "Automação / Temporizadores"
CAT_LAV = "Peças para Lavadora e Bebedouro"
CAT_AGUA = "Filtros e Purificadores de Água"

# ---- Página 2
fam("quadro", "QUADRO PAINEL PARA COMANDO", "pdf:51+49",
    ["55026", "55027", "55029", "55028", "55030", "55031", "55032", "55033", "55034"], CAT_ELE,
    info="Quadro de comando metálico com porta, fechadura e placa de montagem interna (laranja). "
         "Medidas A x L x P (cm) indicadas na descrição.")
fam("mala_compacta", "MALA COMPACTA P/ FERRAMENTAS", "pdf:48:L", ["54752"], CAT_FER, "FACON",
    "Dimensões 31 x 20 x 24 cm. Alça para transporte reforçada.", ref="BS006")
fam("mala_fundo", "MALA C/ FUNDO REFORÇADO", "pdf:48:R", ["54753"], CAT_FER, "FACON",
    "Dimensões 43 x 27 x 28 cm. Fundo resistente, alça removível.", ref="BS008")
fam("mala_inox", "MALA P/ FERRAMENTAS C/ ALÇA INOX BIG PLUS", "pdf:47:L", ["54755"], CAT_FER, "FACON",
    "Medidas no catálogo: 230 x 360 x 230 (indicado em cm; provavelmente mm). Alça em inox.", ref="BS009")
fam("mochila", "MOCHILA P/ FERRAMENTAS S/ ESTOJO", "pdf:47:R", ["54756"], CAT_FER, "FACON",
    "Mochila para ferramentas com bolsos externos, sem estojo interno.")
fam("mala_fit", "MALA FIT P/ FERRAMENTAS", "pdf:46", ["54760"], CAT_FER, "FACON",
    "Dimensões 43 x 27 x 28 cm.", ref="4648")

# ---- Página 3
fam("luva_wk31", "LUVA ANTICORTE WORKER WK31", "pdf:96", [], CAT_EPI, "WORKER",
    "Luva de proteção anticorte com banho na palma.", ref="WK31")
fam("luva_ve702", "LUVA POLIÉSTER BANHO PU VE702PG", "pdf:100", [], CAT_EPI, "DELTA PLUS",
    "Luva de poliéster com banho de poliuretano (PU) na palma, boa sensibilidade para montagem. "
    "Marca identificada pelo logo na foto.", ref="VE702PG")
fam("luva_ve801", "LUVA NITRÍLICA 33 CM NITREX VE801", "pdf:98", [], CAT_EPI, "",
    "Luva nitrílica de cano longo (33 cm) para manuseio de produtos químicos.", ref="VE801")
fam("oculos_sky", "ÓCULOS PROTEÇÃO UVA UVB SKY", "pdf:102", [], CAT_EPI, "",
    "Óculos de segurança com proteção UVA/UVB, lente escura (verde).", ref="SKY")
fam("oculos_summer", "ÓCULOS PROTEÇÃO UVA UVB SUMMER", "pdf:104", [], CAT_EPI, "",
    "Óculos de segurança com proteção UVA/UVB, lente incolor.", ref="SUMMER")
fam("sapato_tpb100", "SAPATO ELÁSTICO S/ BICO TPB100", "pdf:108",
    ["54824", "54825", "54826", "54827", "54828", "54829", "54830"], CAT_EPI, "CARTON",
    "Sapato ocupacional branco com elástico lateral, sem biqueira. Numeração ao final da descrição.",
    ref="TPB100")
fam("sapato_cob101", "SAPATO BRANCO SEM BICO COB 101", "pdf:106",
    ["54838", "54839", "54840", "54841", "54842", "54843", "54844"], CAT_EPI, "CARTON",
    "Sapato polimérico branco, sem biqueira, fácil de lavar. Numeração ao final da descrição.", ref="COB101")
fam("cap_cbb60", "CAPACITOR SIMPLES 250V CBB60", "pdf:90",
    ["53140", "55202", "54104", "53141", "53142", "53143", "53144", "53145", "53146", "53147", "53350", "54120",
     "55201", ("53122", "250V")], CAT_CAP, "FACON",
    "Capacitor de funcionamento (permanente) CBB60, 250 VAC, tolerância ±5%, 50/60 Hz, terminais tipo faston. "
    "Uso em motores monofásicos (ventiladores, bombas, lavadoras).", prefixo="CAPACITOR SIMPLES CBB60 ", ref="CBB60")
fam("cap_cbb60_fio", "CAPACITOR COM FIO 250V CBB60", "pdf:88",
    ["53503", "53504", "53505", "53506", "53507", "53508", "53509", "53148", "54105", "53149", "53150", "53494",
     "53495", "53151", "53496", "53497", "53152"], CAT_CAP, "FACON",
    "Capacitor de funcionamento CBB60 com cabos (fios) de ligação, 250 VAC, tolerância ±5%, 50/60 Hz. "
    "Uso em motores monofásicos.", prefixo="CAPACITOR CBB60 ", ref="CBB60")
fam("cap_cbb65", "CAPACITOR SIMPLES 440V CBB65", "pdf:92",
    [("53122", "440V"), "52763", "52764", "52765", "52766", "52767", "52768", "52769", "52770", "52771", "52772",
     "52773", "53123", "53124"], CAT_CAP, "FACON",
    "Capacitor de funcionamento CBB65 em carcaça de alumínio, 440 VAC, tolerância ±5%. "
    "Uso em compressores e motores de ar-condicionado e refrigeração.", prefixo="CAPACITOR SIMPLES CBB65 ", ref="CBB65")
fam("cap_duplo", "CAPACITOR DUPLO 440V / 250V CBB65", "pdf:94", ["__CBB65__"], CAT_CAP, "FACON",
    "Capacitor duplo CBB65 (compressor + ventilador) em um só corpo, 3 bornes (C / HERM / FAN). "
    "Capacitâncias no formato compressor + ventilador; tensão conforme descrição.", prefixo="CAPACITOR DUPLO ",
    ref="CBB65")

# ---- Página 4
fam("suporte_evap", "SUPORTE PARA EVAPORADORA", "pdf:115", [], CAT_INS, "",
    "Par de suportes metálicos (mão-francesa) para fixação de unidade de ar-condicionado.")
fam("tubex", "TUBO ESPONJOSO (TUBEX)", "pdf:123", [], CAT_INS, "",
    "Isolamento térmico esponjoso para tubulação de cobre de ar-condicionado.")
fam("tubo_cobre", "TUBO DE COBRE", "pdf:121", [], CAT_INS, "",
    "Tubo de cobre em rolo (panqueca) para instalações de refrigeração e ar-condicionado.")
fam("manta", "MANTA ELASTOMÉRICA", "pdf:125", ["54086"], CAT_INS, "",
    "Manta isolante elastomérica 19 mm, 100 x 100 cm, para isolamento térmico de dutos e equipamentos.")
fam("tubo_elast", "TUBO ELASTOMÉRICO", "pdf:119", [("54081", "TUBO")], CAT_INS, "",
    "Tubo isolante elastomérico, parede 19 mm, para tubo de 1.1/8\".")
fam("fita_elast", "FITA ELASTOMÉRICA", "pdf:126", ["52936"], CAT_INS, "",
    "Fita autoadesiva elastomérica 3 mm x 50 mm x 9 m para acabamento e vedação de isolamento.")
fam("rele_rp", "RELÉ TECHUSER RP", "pdf:127", ["53156", "53157", "53158"], CAT_REF, "TECHUSER",
    "Relé de partida tipo RP para compressor hermético de refrigeração doméstica, 110 V; potência (HP) na descrição.",
    ref="RP")
fam("rele_pw", "RELÉ EMBRACO/DANFOS PW", "pdf:129", ["53155", "53154", "53153"], CAT_REF, "",
    "Relé de partida tipo PW compatível com compressores Embraco/Danfoss, 110 V; potência (HP) na descrição.",
    prefixo="RELÉ PARTIDA EMBRACO/DANFOSS ", ref="PW")
fam("protetor_qd", "PROTETOR TÉRMICO GELADEIRA QD", "pdf:131", ["52461", "52460", "52464", "52463", "52462"],
    CAT_REF, "", "Protetor térmico (klixon) tipo QD para compressor de geladeira; potência (HP) na descrição.",
    prefixo="PROTETOR TÉRMICO GELADEIRA QD ", ref="QD")
fam("rele_potencia", "RELÉ DE POTÊNCIA", "pdf:140", ["53417"], CAT_REF, "",
    "Relé de potência para placas de ar-condicionado/refrigeração. Foto do catálogo: Everwell P/N PR-84 (conferir).")
fam("rele_embraco3", "RELÉ EMBRACO 03 TERMINAIS", "pdf:146", ["55298", "55299", "55300", "55301"], CAT_REF, "",
    "Relé de partida reforçado, 3 terminais, padrão Embraco, 110 V / 60 Hz; potência (HP) na descrição.")
fam("contatora_bif", "CONTATORA BIFÁSICA", "pdf:142", ["53323"], CAT_ELE, "FACON",
    "Contator de propósito definido (1 polo + ponte), bobina 220 V, 25 A, para condensadoras de ar-condicionado.")
fam("protetor_ar", "PROTETOR TÉRMICO P/AR", "pdf:147", ["1683", "3429"], CAT_REF, "",
    "Protetor térmico para compressor de ar-condicionado 127 V; faixa de capacidade (BTU/h) na descrição.")
fam("contator", "CONTATOR MAGNÉTICO", "pdf:133",
    ["52306", "52307", "54084", "54085", "54141", "51846", "1049", "53733", "52305", "53324", "53708", "1053",
     "52587", "52853", "52588", "53854", "52589", "52336", "53431"], CAT_ELE, "",
    "Contator magnético com bobina 220 V para acionamento de motores e compressores; nº de polos (MONO/BIF/TRIF) "
    "e corrente nominal na descrição.")
fam("rele_termico", "RELÉ DE SOBRECARGA", "pdf:144",
    ["52220", "52221", "53849", "52222", "53850", "53852", "53851"], CAT_ELE, "DECORLUX",
    "Relé térmico de sobrecarga para proteção de motores; faixa de ajuste de corrente na descrição. "
    "Montagem acoplada ao contator.")
fam("rele_contatora", "RELÉ CONTATORA", "pdf:138", ["53697", "54147"], CAT_ELE, "FACON",
    "Relé contator 30 A / 277 VAC para placas e comandos de ar-condicionado; nº de pinos na descrição.")

# ---- Página 5 (BW / FACON)
fam("alumax_verde", "ALUMAX VERDE", "pdf:153", ["3431"], CAT_QUI, "BW",
    "Vareta de solda para alumínio (Alumax Verde), nova fórmula para reparo de vazamentos em tubos de alumínio.")
fam("solda_hvac", "SOLDA FRIA HVAC SUPER MEGA PRO BW", "pdf:164", ["3439"], CAT_QUI, "BW",
    "Solda fria / selante de alta pressão para sistemas HVAC, frasco 15 g.")
fam("alumax_c", "ALUMAX C", "pdf:159", ["53311"], CAT_QUI, "BW", "Kit de solda fria Alumax C.")
fam("antichama", "ANTI CHAMAS BW-12", "pdf:162", ["54034"], CAT_QUI, "BW",
    "Spray protetor antichamas para proteger componentes durante a brasagem.", ref="BW-12")
fam("desumificante", "DESUMIFICANTE S39", "pdf:188", ["5309", "53890"], CAT_QUI, "BW",
    "Desumidificante S39 para eliminar umidade do sistema de refrigeração; volume na descrição.", ref="S39")
fam("trincal", "FLUXO TRINCAL", "pdf:155", ["52280"], CAT_QUI, "BW",
    "Fluxo em pó para soldagem (brasagem) de metais.")
fam("aron", "ARON - 200", "pdf:157", [""], CAT_QUI, "BW",
    "Fluxo especial para solda prata com todas as ligas de prata, pote 50 g.", ref="ARON-200")
fam("tapa_fugas", "TAPA FUGAS F5/ F6", "pdf:161", ["53735", "53711", "54183", "54455"], CAT_QUI, "BW",
    "Selante de vazamentos (tapa fugas) dose única para sistemas de refrigeração/ar-condicionado; "
    "versão e volume na descrição.")
fam("leak_repair", "TAPA FUGAS LEAK-REPAIR", "pdf:179", ["52552"], CAT_QUI, "BW",
    "Selante de vazamentos Leak-Repair 15 ml em seringa, sela microvazamentos.", ref="LEAK-REPAIR")
fam("capidryl", "CAPIDRYL", "pdf:165", ["5308"], CAT_QUI, "BW",
    "Produto para limpeza de tubo capilar, 100 ml.")
fam("alicate_amp", "ALICATE C/ AMPERÍMETRO E TEMPERATURA 266FT", "pdf:166", ["52933"], CAT_FER, "FACON",
    "Alicate amperímetro digital com medição de temperatura (termopar) e pontas de prova.", ref="266FT")
fam("capacimetro", "CAPACÍMETRO DIGITAL CM9601A", "pdf:176", ["54135"], CAT_FER, "FACON",
    "Capacímetro digital para teste de capacitores.", ref="CM9601A")
fam("mult_dt830", "MULTÍMETRO DIGITAL DT-830B", "pdf:177", [("52931", "DT-830B")], CAT_FER, "FACON",
    "Multímetro digital de uso geral com pontas de prova.", ref="DT-830B")
fam("mult_cap", "MULTÍMETRO E CAPACÍMETRO", "pdf:168", ["4044"], CAT_FER, "FACON",
    "Multímetro digital com função capacímetro e pontas de prova.")
fam("mult_my63", "MULTÍMETRO DIGITAL My63 20KHZ", "pdf:178", [("52931", "MY63")], CAT_FER, "FACON",
    "Multímetro digital com frequencímetro até 20 kHz.", ref="MY63")
fam("ferro_solda", "FERRO DE SOLDA", "pdf:174", ["54167", "52640"], CAT_FER, "FACON",
    "Ferro de solda 127 V; potência na descrição.")
fam("ponta_prova", "PONTAS DE PROVA", "pdf:170", ["52635"], CAT_FER, "FACON",
    "Par de pontas de prova para multímetro.", ref="JR9212")
fam("sugador", "SUGADOR DE SOLDA", "pdf:172", ["52638"], CAT_FER, "FACON", "Sugador de solda manual.")

# ---- Página 6 (termostatos, motores, COEL)
fam("motor_black", "MOTOR BLACK VENT REFR DOMEST 2 POLOS /BRE 43A /BRE 49 B", "pdf:213", [], CAT_REF, "",
    "Motor ventilador para refrigerador doméstico, 2 polos (aplicação BRE43A / BRE49B).", ref="IS-272113BWPC")
fam("motor_electrolux", "MOTOR VENT ELETROLUX/BRASTEMP CONSUL/SAMSUNG", "pdf:215", [], CAT_REF, "",
    "Motor ventilador para refrigeradores Electrolux, Brastemp, Consul e Samsung.", ref="YJF611/10Z.P")
fam("termostato", "THERMOSTATO", "pdf:217",
    ["53682", ("53635", "15000"), ("53635", "45000"), "53684", "53679", "53680", "53343", "53637", "53640", "53639"],
    CAT_REF, "", "Termostato para refrigerador com bulbo capilar; acompanha espelho, knob e terminais (kit da foto).",
    prefixo="TERMOSTATO ",
    imgs={"53682": "pdf:217", "53635|15000": "pdf:219", "53635|45000": "pdf:221", "53684": "pdf:223",
          "53679": "pdf:225", "53680": "pdf:227", "53343": "pdf:231", "53637": "pdf:233", "53640": "pdf:235",
          "53639": "pdf:229"})
fam("coel", "COEL", "pdf:195",
    ["55221", "54851", "54852", "54850", "54857", "54978", "54979", "54977", "54976", "55520",
     ("54856", "AEGMU"), ("54856", "T42"), ("54856", "BVF"), "55021"], CAT_COEL, "COEL", "",
    imgs={"55221": "pdf:195", "54851": "pdf:194", "54852": "pdf:196", "54850": "pdf:198", "54857": "pdf:207",
          "54978": "pdf:200", "54979": "pdf:202", "54977": "pdf:202", "54976": "pdf:202", "55520": "pdf:202",
          "54856|AEGMU": "pdf:204", "54856|T42": "pdf:209", "54856|BVF": "pdf:211", "55021": "pdf:210"})
fam("rtdf_12h", "RELÉ DE TEMPO RTDF 12H 60 MIN COEL", "pdf:205", [], CAT_COEL, "COEL",
    "Relé de tempo (temporizador de degelo) RTDF 12 h / 60 min.", ref="RTDF")

# ---- Página 7
fam("curvador", "CURVADOR DE TUBO DE COBRE", "pdf:261", ["53175", "53174", "53176", "53173"], CAT_FER, "FACON",
    "Curvador de alavanca para tubo de cobre; bitola na descrição.")
fam("filtro_secador", "FILTRO SECADOR", "pdf:266",
    ["53821", "53824", "55197", "55198", "53820", "53823", "54139", "53825"], CAT_REF, "FACON",
    "Filtro secador de linha de líquido com rosca, para CFC/HCFC/HFC; pressão máx. de trabalho 680 PSIG "
    "(4700 kPa, conforme foto). Bitola e modelo na descrição.")
fam("dreno", "DRENO UNIVERSAL 1,50M PARA AR CONDICIONADO", "pdf:263", ["53794"], CAT_INS, "",
    "Mangueira de dreno transparente universal para ar-condicionado, 1,50 m.")
fam("dreno60", "MANGUEIRA DE DRENAGEM 60CM PARA AR CONDICIONADO", "pdf:264", ["53493"], CAT_INS, "",
    "Mangueira de drenagem 60 cm para ar-condicionado.")
fam("catraca", "CHAVE CATRACA", "pdf:276", ["53492"], CAT_FER, "FACON",
    "Chave catraca de refrigeração com 4 bitolas (para registros de serviço).")
fam("pente_metal", "PENTE ALETA METAL", "pdf:278", ["53490"], CAT_FER, "FACON",
    "Pente para desamassar aletas de serpentina (metal).")
fam("pente_plast", "PENTE ALETA PLÁSTICO", "pdf:280", ["53491"], CAT_FER, "FACON",
    "Pente para desamassar aletas de serpentina (plástico, múltiplos passos).")
fam("micro_motor", "MICRO MOTOR 1/40 E 1/25", "pdf:282", ["52926", "54123", "52925", "52124"], CAT_REF, "FACON",
    "Micro motor para ventilação de condensador/evaporador com hélice de alumínio; potência, tensão e RPM na descrição.")
fam("bomba_vacuo", "BOMBA DE VÁCUO FACON", "pdf:275", ["54127", "54125", "54126"], CAT_FER, "FACON",
    "Bomba de vácuo simples estágio, bivolt 110/220 V 50/60 Hz; vazão (CFM) e modelo na descrição.")
fam("mola", "MOLA PARA CURVAR TUBO DE COBRE", "pdf:286", ["50", "53178", "53177"], CAT_FER, "FACON",
    "Mola para curvar tubo de cobre sem amassar; bitola na descrição.")
fam("polia", "POLIA POLI V LAVADORA BRASTEMP", "pdf:242", ["53870"], CAT_LAV, "DE PLASTIC",
    "Polia Poli V para lavadoras Brastemp 8/9/11 kg (BWB08A / BWB09A / BWB11A).")
fam("puxador", "PUXADOR ELECTROLUX LE750", "pdf:244", ["53879"], CAT_LAV, "DE PLASTIC",
    "Puxador de tampa para lavadora Electrolux LE750.", ref="LE750")
fam("torneira_rosca", "TORNEIRA PARA BEBEDOURO ROSCA", "pdf:246", ["53954"], CAT_LAV, "DE PLASTIC",
    "Torneira de rosca para bebedouro/galão, corpo branco e alavanca azul.")
fam("torneira_premium", "TORNEIRA PARA BEBEDOURO PREMIUM", "pdf:247", ["53953"], CAT_LAV, "DE PLASTIC",
    "Torneira premium de rosca para bebedouro, corpo branco e alavanca azul.")
fam("torneira_longa", "TORNEIRA PARA BEBEDOURO ROSCA LONGA", "pdf:252", ["55594"], CAT_LAV, "DE PLASTIC",
    "Torneira para bebedouro com rosca longa, branca.")
fam("vara", "VARA DE SUSPENSÃO MONDIAL", "pdf:253", ["53873"], CAT_LAV, "DE PLASTIC",
    "Kit de varas de suspensão para lavadora Mondial.")
fam("torneira_esmaltec", "TORNEIRA BEBEDOURO ESMALTEC CONECTOR CINZA", "pdf:260", ["55595"], CAT_LAV, "",
    "Torneira para bebedouro Esmaltec com conector cinza.")
fam("recip_compressor", "RECIPIENTE COM ENCAIXE DO COMPRESSOR", "pdf:259", [("55586", "COMPRESSOR")], CAT_REF, "",
    "Recipiente (bandeja de evaporação) com encaixe no compressor, similar Brastemp.")
fam("suporte_cesto", "SUPORTE CESTO C/ TRAVA LAV BRASTEMP/CONSUL", "pdf:255", ["55592"], CAT_LAV, "",
    "Suporte do cesto com trava para lavadoras Brastemp/Consul BWK15A / BWH15A / CWE13A.")
fam("bandeja_univ", "RECIPIENTE DA BANDEJA DE EVAPORAÇÃO UNIVERSAL", "pdf:256", [("55586", "UNIVERSAL")], CAT_REF,
    "", "Recipiente de bandeja de evaporação universal para refrigeradores.")
fam("recip_th", "RECIPIENTE COM ENCAIXE TECUMSEH TH SIMILAR", "pdf:257", ["55589"], CAT_REF, "",
    "Bandeja de evaporação com encaixe para compressor Tecumseh linha TH (similar).")
fam("recip_ts", "RECIPIENTE COM ENCAIXE TECUMSEH TS SIMILAR", "pdf:258", ["55588"], CAT_REF, "",
    "Bandeja de evaporação com encaixe para compressor Tecumseh linha TS (similar).")

# ---- Página 8 (Planeta Água / IBBL)
fam("mang_fina", "MANGUEIRA FINA 6,35X 1MM", "pdf:306", ["54153"], CAT_AGUA, "PLANETA ÁGUA",
    "Mangueira fina 6,35 x 1 mm para purificadores e bebedouros.")
fam("mang_pacote", "MANGUEIRA PACOTE 2M", "pdf:308", ["53944", "53945", "53943"], CAT_AGUA, "PLANETA ÁGUA",
    "Mangueira para purificadores/bebedouros, pacote com 2 m; bitola na descrição.")
fam("purificador", "PURIFICADOR IDEALE BRANCO", "pdf:309", [("54320", "PURIFICADOR")], CAT_AGUA, "PLANETA ÁGUA",
    "Purificador de água Ideale Basic, cor branca.")
fam("refil_prolux", "REFIL FILTRO ELECTR PROLUX OC/ EP / G OC", "pdf:310",
    [("54320", "REFIL"), "53947", "53948"], CAT_AGUA, "PLANETA ÁGUA", "",
    imgs={"54320|REFIL": "pdf:310", "53947": "pdf:311", "53948": "pdf:312"})
fam("refil_multi", "REFIL FILTRO MULTIMARCAS PLANETA ÁGUA", "pdf:314", ["54318", "54319", "54317", "54152"],
    CAT_AGUA, "PLANETA ÁGUA", "Refil de filtro de água compatível multimarcas; modelo de aplicação na descrição.",
    imgs={"54318": "pdf:314", "54319": "pdf:313", "54317": "pdf:315", "54152": "pdf:316"})
fam("ibbl", "IBBL", "pdf:294", ["52283", "53891", "54165", "54166", "52285", "52284"], CAT_AGUA, "IBBL", "",
    imgs={"52283": "pdf:294", "53891": "pdf:293", "54165": "pdf:295", "54166": "pdf:296", "52285": "pdf:297",
          "52284": "pdf:298"})

# ---- Página 9 (MG Margirius)
MG = {"55067": "pdf:331", "55068": "pdf:333", "55069": "pdf:335", "55070": "pdf:339", "55089": "pdf:355",
      "55082": "pdf:341", "55083": "pdf:343", "55084": "pdf:345", "55085": "pdf:347", "55086": "pdf:349",
      "55087": "pdf:351", "55088": "pdf:353", "55103": "pdf:358+356", "55104": "pdf:360+362", "55105": "pdf:364",
      "55106": "pdf:366", "55107": "pdf:368", "55108": "pdf:370", "55109": "pdf:372", "55090": "pdf:374",
      "55091": "pdf:376", "55097": "pdf:378", "55098": "pdf:378", "55099": "pdf:378", "55100": "pdf:378",
      "55101": "pdf:380", "55102": "pdf:382"}
fam("mg", "MG MARGIRIUS", "pdf:331", list(MG), CAT_ELE, "MG MARGIRIUS", "", imgs=MG)

# ---------------------------------------------------------------------------
# Informações complementares por produto (catálogo + função do produto)
# ---------------------------------------------------------------------------
INFO_ITEM = {
    "55221": "Controlador digital de temperatura para refrigerador/cervejeira. Faz conjunto com o sensor B05G (catálogo).",
    "54851": "Interruptor horário programável analógico (timer) RTM para ligar/desligar cargas em horários definidos.",
    "54852": "Programador horário digital com 20 memórias (RTST 20).",
    "54850": "Programador horário digital BWT-40 com 40 memórias, montagem em trilho DIN.",
    "54857": "Relé de tempo RTDF 6 h / 30 min (equivalente Icematic 94A 240 VAC), usado em máquinas de gelo e degelo.",
    "54978": "Relé de tempo AG com alimentação 12 VCC, escala até 60 segundos.",
    "54979": "Relé de tempo AG, alimentação 94 a 242 VAC, escala até 15 minutos.",
    "54977": "Relé de tempo AG, alimentação 94 a 242 VAC, escala até 15 segundos.",
    "54976": "Relé de tempo AG, alimentação 94 a 242 VAC, escala até 30 segundos.",
    "55520": "Relé de tempo AG, alimentação 94 a 242 VAC, escala até 60 segundos.",
    "54856|AEGMU": "Relé de tempo multiescala AEGMU.",
    "54856|T42": "Temporizador/controlador digital T42, alimentação 100 a 240 V. Aplicações: amassadeiras, autoclaves, "
                 "centrífugas, embaladoras, envasadoras, extrusoras, máquinas gráficas, têxteis, prensas, "
                 "soldadoras, entre outras (catálogo).",
    "54856|BVF": "Relé eletrônico digital de falta de fase. Pode ser usado para acionar alarmes e interromper "
                 "circuitos, protegendo máquinas e equipamentos das falhas na rede de alimentação (catálogo).",
    "55021": "Relé eletrônico digital de falta de fase e sequência de fase BVS1-P. Pode ser usado para acionar alarmes "
             "e interromper circuitos, protegendo máquinas contra falhas na rede (catálogo).",
    "54320|REFIL": "Refil compatível com purificadores Electrolux PA10N / PA20G / PA25G / PA30G / PA40G.",
    "53947": "Refil compatível com purificadores Electrolux PE10B / PE10X.",
    "53948": "Refil compatível com purificadores Electrolux PA21G / PA26G / PA31G.",
    "52283": "Refil de filtro de água IBBL C+3 para purificadores IBBL.",
    "53891": "Refil de filtro IBBL Avanti, sistema 'girou trocou' (troca rápida).",
    "54165": "Tampa da pingadeira cinza para purificador IBBL R600.",
    "54166": "Pingadeira plástica fumê para purificador IBBL.",
    "52285": "Torneira de alavanca azul para bebedouros IBBL.",
    "52284": "Torneira de alavanca branca para bebedouros IBBL.",
    "55067": "Interruptor de alavanca bipolar 20 A.",
    "55068": "Interruptor de alavanca unipolar 15 A.",
    "55069": "Interruptor de alavanca bipolar 15 A.",
    "55070": "Interruptor de alavanca unipolar 15 A.",
    "55089": "Plugue macho gigante 2P+T 20 A, corpo preto.",
    "55082": "Tomada tripla 2P+T para extensão, cor cinza.",
    "55083": "Plugue macho 2P 10 A, corpo preto.",
    "55084": "Plugue macho 2P+T 10 A, corpo preto.",
    "55085": "Plugue fêmea 2P+T 10 A, corpo preto.",
    "55086": "Plugue fêmea 2P+T 20 A, corpo preto.",
    "55087": "Plugue macho 2P 20 A, corpo preto.",
    "55088": "Plugue macho 20 A, corpo preto.",
    "55103": "Botão duplo pulsador faceado (LIGA/DESLIGA) com blocos de contato 1NA + 1NF.",
    "55104": "Botão duplo pulsador com visor vermelho e blocos de contato.",
    "55105": "Sinaleiro (lâmpada de sinalização) monobloco 220 V, cor amarela, 22 mm.",
    "55106": "Sinaleiro (lâmpada de sinalização) monobloco 220 V, cor branca, 22 mm.",
    "55107": "Sinaleiro (lâmpada de sinalização) monobloco 220 V, cor verde, 22 mm.",
    "55108": "Sinaleiro (lâmpada de sinalização) monobloco 220 V, cor vermelha, 22 mm.",
    "55109": "Sinaleiro (lâmpada de sinalização) monobloco 220 V, cor azul, 22 mm.",
    "55090": "Tomada quíntupla 2P+T 20 A para extensão, cor cinza.",
    "55091": "Filtro de linha bivolt com 1,5 m de cabo, cor cinza.",
    "55097": "DPS (dispositivo de proteção contra surtos) 12 kA, 127 V, classe II, trilho DIN.",
    "55098": "DPS (dispositivo de proteção contra surtos) 30 kA, 127 V, classe II, trilho DIN.",
    "55099": "DPS (dispositivo de proteção contra surtos) 45 kA, 127 V, classe II, trilho DIN.",
    "55100": "DPS (dispositivo de proteção contra surtos) 60 kA, 127 V, classe II, trilho DIN.",
    "55101": "Caixa de sobrepor Slin com 1 tomada 20 A.",
    "55102": "Caixa de sobrepor Slin para disjuntor.",
}

# ---------------------------------------------------------------------------
# Correções de digitação na descrição (registradas como alerta)
# ---------------------------------------------------------------------------
CORRECOES = [(r"\bDECOLUX\b", "DECORLUX"), (r"\bISOLAMTE\b", "ISOLANTE"), (r"\bSANSUNG\b", "SAMSUNG"),
             (r"ÁGUAC \+3", "ÁGUA C+3"), (r"\bTERMICO\b", "TÉRMICO"), (r"\bRELE\b", "RELÉ"),
             (r"\bELECTRÔNICO\b", "ELETRÔNICO"), (r"\bAMPERIMETRO\b", "AMPERÍMETRO"),
             (r"\bCAPACIMETRO\b", "CAPACÍMETRO"), (r"\bMULTIMETRO\b", "MULTÍMETRO"), (r"440VAc\b", "440VAC"),
             (r"\bPOLIMERICO\b", "POLIMÉRICO"), (r"1/8PH\b", "1/8HP"), (r"250VCOM\b", "250V COM"),
             (r"PDL1 3\b", "PDL1-3"), (r"\bFEMEA\b", "FÊMEA"), (r"\bQUINTAPLA\b", "QUÍNTUPLA"),
             (r"\bELETRONIC\b", "ELETRÔNICO"), (r"8UFX 250VAC", "8UF X 250VAC"), (r"\bESTAGIO\b", "ESTÁGIO"), (r"\bPLASTICA\b", "PLÁSTICA"),
             (r"\bALCA\b", "ALÇA")]

# Alertas específicos (conferência humana)
ALERTA_ITEM = {
    "52771": "Descrição diz 59UF — provável 50UF. Conferir.",
    "53129": "Mesma descrição do código 52792 (CBB65 50UF+5UF 440VAC): possível cadastro duplicado.",
    "52792": "Mesma descrição do código 53129 (CBB65 50UF+5UF 440VAC): possível cadastro duplicado.",
    "53682": "Seção do catálogo diz RC-42600-2, mas a descrição diz RC-53600-2 (igual ao 53684). Conferir modelo.",
    "53680": "Seção do catálogo diz RFR 4009-2, descrição diz RC-4209-2. Conferir modelo.",
    "53493": "No catálogo a descrição está igual à do 53794; título da seção: MANGUEIRA DE DRENAGEM 60CM.",
    "53943": "Título da seção: MANGUEIRA GROSSA 9,52X1,60MM, mas a descrição repete a do 53945 (8 X 1,66MM). Conferir.",
    "53953": "Descrição igual à do 53954 (ROSCA BRANCO E AZUL); título da seção: TORNEIRA PREMIUM.",
    "54166": "Título da seção: PINGADEIRA PLAST FUMÊ, mas a descrição repete a do 54165 (TAMPA CINZA). Conferir.",
    "54755": "Medidas no catálogo 230 x 360 x 230 'cm' — provavelmente mm. Conferir antes de publicar.",
    "50": "Código muito curto (50). Conferir se é o código correto no sistema.",
    "55021": "Descrição cita BVF-1P, mas a referência é BVS1-P (falta e sequência de fase). Conferir.",
    "55091": "No catálogo o título 'FILTRO DE LINHA MG-3001' aparece repetido sobre a foto dos DPS.",
    "52307": "'ROHS' é selo de conformidade, não marca. Marca não identificada no catálogo.",
}


def norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()


def achar_familia(linha):
    cod, desc = linha["codigo"], norm(linha["descricao"])
    for f in F:
        for c in f["codes"]:
            if c == "__CBB65__":
                if desc.startswith("CBB65"):
                    return f, None
                continue
            if isinstance(c, tuple):
                if cod == c[0] and norm(c[1]) in desc:
                    return f, f"{c[0]}|{c[1]}"
            elif cod == c and (cod or "ARON" in desc):
                return f, None
    return None, None


# ---------------------------------------------------------------------------
produtos, descartadas = [], []
for ln in linhas:
    if not ln["descricao"]:
        descartadas.append(ln)  # ex.: "COD.53821" impresso dentro da foto
        continue
    f, chave = achar_familia(ln)
    if f is None:
        descartadas.append(ln)
        continue
    desc = ln["descricao"].strip()
    if f["prefixo"] and not norm(desc).startswith(norm(f["prefixo"]).split()[0]):
        desc = f["prefixo"] + desc
    alertas = []
    for pat, rep in CORRECOES:
        novo = re.sub(pat, rep, desc)
        if novo != desc:
            antigo = re.search(pat, desc).group(0)
            alertas.append(f"Descrição corrigida ({antigo} → {rep}).")
            desc = novo
    desc = re.sub(r"\s+", " ", desc).strip()
    # mesma linha repetida no catálogo (ex.: espaçamento diferente ou versão resumida da descrição)
    tok = set(norm(desc).split())
    igual = next((q for q in produtos if q["codigo"] == ln["codigo"] and q["codigo"] and (
        norm(q["descricao"]).replace(" ", "") == norm(desc).replace(" ", "")
        or tok <= set(norm(q["descricao"]).split()) or set(norm(q["descricao"]).split()) <= tok)), None)
    if igual:
        if len(desc) > len(igual["descricao"]):
            igual["descricao"] = desc
        continue
    chave_item = chave or ln["codigo"]
    img = f["imgs"].get(chave_item) or f["imgs"].get(ln["codigo"]) or f["img"]
    produtos.append(dict(codigo=ln["codigo"], chave=chave_item, descricao=desc, familia=f["id"],
                         familia_titulo=f["titulo"], categoria=f["categoria"], marca=f["marca"], ref=f["ref"],
                         info=INFO_ITEM.get(chave_item) or INFO_ITEM.get(ln["codigo"]) or f["info"], img=img,
                         pagina=ln["pagina"], alertas=alertas, origem="Catálogo PDF"))

# Produtos do catálogo sem código impresso
for f in F:
    if not f["codes"]:
        produtos.append(dict(codigo="", chave=f["id"], descricao=f["titulo"], familia=f["id"], familia_titulo=f["titulo"],
                             categoria=f["categoria"], marca=f["marca"], ref=f["ref"], info=f["info"], img=f["img"],
                             pagina=None, alertas=["Produto sem código no catálogo — informar código do sistema."],
                             origem="Catálogo PDF"))

# Imagens avulsas enviadas pelo usuário (fotos e PSD)
AVULSAS = [
    ("", "user:1.jpg", "BOTINA DE SEGURANÇA COM ELÁSTICO PRETA", CAT_EPI,
     "Botina de segurança em couro preto com elástico lateral e solado tratorado (identificação pela foto)."),
    ("", "user:2.jpg", "BOTINA DE SEGURANÇA COM CADARÇO PRETA", CAT_EPI,
     "Botina de segurança em couro preto com cadarço, ilhoses metálicos e colarinho em tela (identificação pela foto)."),
    ("", "user:3.jpg", "PROTETOR CONTRA SURTOS DE TOMADA (PLUGUE 2P+T)", CAT_ELE,
     "Protetor eletrônico de tomada (plugue/adaptador) contra surtos, corpo transparente (identificação pela foto)."),
    ("", "user:4.jpg", "SENSOR DE TEMPERATURA COM BULBO DE COBRE P/ AR CONDICIONADO", CAT_REF,
     "Sensor (termistor) com bulbo de cobre, cabo preto e conector, típico de placas de ar-condicionado split "
     "(identificação pela foto)."),
    ("", "user:5.jpg", "SENSOR DE TEMPERATURA COM CABO E CONECTOR", CAT_REF,
     "Sensor de temperatura com cabo e conector (identificação pela foto)."),
    ("58450", "psd:COD_58450", "CABO FLEXÍVEL VERDE", CAT_ELE,
     "Cabo flexível de cobre com isolação verde (foto do arquivo COD_58450.psd). Informar bitola/seção."),
    ("", "psd:contator_01_polo", "CONTATOR 1 POLO 25A 220V FACON", CAT_ELE,
     "Contator de propósito definido 1 polo, 25 A, bobina 220 V (etiqueta da foto). Arquivo contator_01_polo.psd."),
    ("", "psd:KTM_1000_copiar", "KTM 1000 (PEÇA PLÁSTICA BRANCA)", CAT_REF,
     "Imagem do arquivo KTM_1000_copiar.psd. Descrição a confirmar."),
]
for cod, img, desc, cat, info in AVULSAS:
    alert = ["Imagem enviada sem código — informar código do sistema."] if not cod else [
        "Código vindo do nome do arquivo PSD; conferir descrição/bitola."]
    if "contator_01_polo" in img:
        alert = ["Sem código. Provável COD 53323 (CONTATOR 220V BIF 25A FACON) — conferir."]
    if "KTM" in img:
        alert.append("Produto não identificado pela imagem; confirmar descrição.")
    produtos.append(dict(codigo=cod, chave=img, descricao=desc, familia=img, familia_titulo=desc, categoria=cat,
                         marca="FACON" if "FACON" in desc else "", ref="KTM 1000" if "KTM" in img else None,
                         info=info, img=img, pagina=None, alertas=alert, origem="Imagem enviada"))

# ---------------------------------------------------------------------------
# Referência do fabricante (quando não definida na família) e marca por item
# ---------------------------------------------------------------------------
REF_PADROES = [r"REF-\s*([A-Z0-9][A-Z0-9\-]+)", r"\b(SAD-\d{3}|SDML-\d{3})\b", r"\b(VP\d{3,4})\b",
               r"\b(TMU\d-\d{3}|PDL\d[- ]\d|PLD\d-\d|TMD\d-\d|CS-\d{3}A|MG-\d{4}|CP\d-\d{2})\b",
               r"\b(LD\d{2})\b", r"\b(1\d{4})\s*$", r"\b(RC-? ?\d{4,5}-\d|RFR \d{4}-\d|W-R ?[A-Z]{0,2} ?\d{4,5}(?:-\d)?)\b",
               r"\b(P03C)\b"]
for p in produtos:
    d = p["descricao"]
    if not p["ref"]:
        for pat in REF_PADROES:
            m = re.search(pat, d)
            if m:
                p["ref"] = m.group(1).replace(" ", "-") if "PDL" in m.group(1) else m.group(1)
                break
    if p["familia"] == "contator":
        m = re.search(r"\b(FACON|DECORLUX|SOPRANO|CHINT|EVERWELL)\b", d)
        p["marca"] = m.group(1) if m else ""
    if p["familia"] == "coel" and p["codigo"] == "55221":
        p["ref"] = "P03CGBARR-S-0FS"
    if p["familia"] == "bomba_vacuo":
        m = re.search(r"\b(VP\d+)\b", d)
        p["ref"] = m.group(1) if m else p["ref"]
    p["ref"] = re.sub(r"\s+", " ", (p["ref"] or "").replace("RC- ", "RC-")).strip()
    if p["chave"] in ALERTA_ITEM:
        p["alertas"].append(ALERTA_ITEM[p["chave"]])
    elif p["codigo"] in ALERTA_ITEM and p["origem"] == "Catálogo PDF":
        p["alertas"].append(ALERTA_ITEM[p["codigo"]])

# Mesmo código usado para produtos diferentes
from collections import defaultdict
por_cod = defaultdict(list)
for p in produtos:
    if p["codigo"]:
        por_cod[p["codigo"]].append(p)
for cod, ps in por_cod.items():
    if len(ps) > 1:
        for p in ps:
            outros = "; ".join(o["descricao"] for o in ps if o is not p)
            p["alertas"].insert(0, f"CÓDIGO REPETIDO no catálogo para produto diferente: {outros}")

# Ordem: família (ordem do catálogo) e depois ordem de aparição
ordem_fam = {f["id"]: i for i, f in enumerate(F)}
for i, p in enumerate(produtos):
    p["ordem"] = (ordem_fam.get(p["familia"], 999), i)
produtos.sort(key=lambda p: p["ordem"])
for p in produtos:
    del p["ordem"]

json.dump(produtos, open(WORK / "base_produtos.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(produtos)} produtos | {len({p['img'] for p in produtos})} imagens distintas | "
      f"{sum(1 for p in produtos if p['alertas'])} com alerta")
print("Linhas descartadas:")
for d in descartadas:
    print("  ", d["pagina"], d["codigo"], d["descricao"][:60], "|", d["secao"][:30])
