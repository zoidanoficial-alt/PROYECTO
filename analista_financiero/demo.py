"""Datos de ejemplo: una tostadora de café con 6 meses de operación.

La historia (para probar la investigación guiada): las ventas crecen ~40%
porque se empujan cafeteras (margen bajo), el proveedor de café verde sube
su precio, sube la renta, se contrata a una persona y hay una reparación
extraordinaria. Resultado: se vende más, pero se gana mucho menos.

También trae errores típicos a propósito: un título arriba de la tabla, una
columna desconocida, un registro duplicado, una fecha imposible, un gasto
en dólares, un gasto con signo negativo y un "total" que no cuadra.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

MESES = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]

PRODUCTOS = {
    #                  precio base, precio actual, costo base, costo actual, unidades base, unidades actual
    "Café en grano 1kg": (320, 320, 150, 185, 400, 420),
    "Cafetera de goteo": (900, 850, 790, 790, 40, 120),  # promoción
    "Taza de cerámica": (120, 120, 45, 45, 150, 150),
}

CLIENTES = [("Mostrador", 0), ("Cafetería El Portal", 30), ("Distribuidora Norte", 45)]


def _fecha(mes: str, dia: int) -> pd.Timestamp:
    return pd.Timestamp(f"{mes}-{dia:02d}")


def generar_tablas(semilla: int = 7) -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(semilla)
    fin_datos = pd.Timestamp("2026-09-30")
    ventas, costos, gastos = [], [], []
    folio = 1000
    for i, mes in enumerate(MESES):
        actual = i >= 3
        for prod, (pb, pa, cb, ca, qb, qa) in PRODUCTOS.items():
            precio, costo_u = (pa, ca) if actual else (pb, cb)
            q_mes = qa if actual else qb
            # rampa de cafeteras: julio aún es transición
            if prod.startswith("Cafetera") and mes == "2026-07":
                q_mes = 90
            partes = rng.multinomial(q_mes, [0.25] * 4)
            for semana, q in enumerate(partes):
                if q == 0:
                    continue
                dia = 3 + semana * 7
                cliente, plazo = CLIENTES[(semana + i) % len(CLIENTES)]
                f = _fecha(mes, dia)
                cobro = f + pd.Timedelta(days=plazo)
                folio += 1
                ventas.append({
                    "Fecha": f.strftime("%d/%m/%Y"), "Folio": f"F-{folio}", "Cliente": cliente,
                    "Producto": prod, "Cantidad": int(q), "Importe": f"${q * precio:,.2f}", "Moneda": "MXN",
                    "Fecha de cobro": cobro.strftime("%d/%m/%Y") if cobro <= fin_datos else "",
                    "Notas internas": "revisar" if folio % 17 == 0 else "",
                })
            costos.append({
                "Fecha": _fecha(mes, 28).strftime("%d/%m/%Y"), "Producto": prod, "Cantidad": int(q_mes),
                "Importe": round(q_mes * costo_u, 2),
                "Fecha de pago": (_fecha(mes, 28) + pd.Timedelta(days=20)).strftime("%d/%m/%Y")
                if _fecha(mes, 28) + pd.Timedelta(days=20) <= fin_datos else "",
            })
        renta = 23000 if actual else 18000
        nomina = 38000 if mes in ("2026-04", "2026-05", "2026-06", "2026-07") else 46000
        fijos = [
            ("Renta del local", "Renta", renta, 1),
            ("Nómina quincena 1", "Nómina", nomina / 2, 15),
            ("Nómina quincena 2", "Nómina", nomina / 2, 28),
            ("CFE", "Luz y servicios", 3500 + (300 if actual else 0), 10),
            ("Anuncios en redes", "Publicidad", 9000 if actual else 6000, 5),
            ("Mantenimiento menor", "Mantenimiento", 1200, 20),
        ]
        for concepto, cat, monto, dia in fijos:
            gastos.append({"Fecha": _fecha(mes, dia).strftime("%d/%m/%Y"), "Concepto": concepto,
                           "Categoría": cat, "Importe": round(monto, 2), "Moneda": "MXN",
                           "Fecha de pago": _fecha(mes, dia).strftime("%d/%m/%Y")})
    # Reparación extraordinaria
    gastos.append({"Fecha": "18/08/2026", "Concepto": "Reparación de tostadora", "Categoría": "Mantenimiento",
                   "Importe": 18000, "Moneda": "MXN", "Fecha de pago": "25/08/2026"})

    # --- errores a propósito ---
    ventas.append(dict(ventas[5]))  # duplicado exacto
    ventas.append({**ventas[8], "Fecha": "31/02/2026", "Folio": "F-9999"})  # fecha imposible
    gastos.append({"Fecha": "12/09/2026", "Concepto": "Suscripción software contable", "Categoría": "Software",
                   "Importe": 49, "Moneda": "USD", "Fecha de pago": "12/09/2026"})
    gastos.append({"Fecha": "14/09/2026", "Concepto": "Papelería", "Categoría": "Papelería",
                   "Importe": -850, "Moneda": "MXN", "Fecha de pago": "14/09/2026"})  # signo negativo
    ventas_junio = sum(
        float(v["Importe"].replace("$", "").replace(",", "")) for v in ventas[:-2] if v["Fecha"].endswith("/06/2026"))
    ventas.append({"Fecha": "30/06/2026", "Folio": "", "Cliente": "", "Producto": "TOTAL VENTAS JUNIO",
                   "Cantidad": "", "Importe": f"${ventas_junio + 3500:,.2f}", "Moneda": "MXN",
                   "Fecha de cobro": "", "Notas internas": ""})
    return {"Ventas": pd.DataFrame(ventas), "Costo de ventas": pd.DataFrame(costos), "Gastos": pd.DataFrame(gastos)}


def generar_excel(ruta: str | Path) -> Path:
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tablas = generar_tablas()
    with pd.ExcelWriter(ruta, engine="openpyxl") as xw:
        for hoja, df in tablas.items():
            # La hoja de ventas trae un título encima de la tabla, como muchos reportes reales.
            inicio = 2 if hoja == "Ventas" else 0
            df.to_excel(xw, sheet_name=hoja, index=False, startrow=inicio)
            if inicio:
                xw.sheets[hoja].cell(row=1, column=1, value="Reporte de ventas 2026 — Café La Montaña")
    return ruta


def generar_csv(ruta: str | Path) -> Path:
    """Misma información en un solo CSV con columna «Tipo» (formato libro de movimientos)."""
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    t = generar_tablas()
    filas = []
    for _, v in t["Ventas"].iterrows():
        filas.append({"Fecha": v["Fecha"], "Tipo": "Venta", "Concepto": v["Producto"], "Categoría": "Ventas",
                      "Producto": v["Producto"], "Cantidad": v["Cantidad"], "Monto": v["Importe"],
                      "Moneda": v["Moneda"], "Fecha de cobro/pago": v["Fecha de cobro"]})
    for _, c in t["Costo de ventas"].iterrows():
        filas.append({"Fecha": c["Fecha"], "Tipo": "Costo de venta", "Concepto": f"Costo {c['Producto']}",
                      "Categoría": "Costo de ventas", "Producto": c["Producto"], "Cantidad": c["Cantidad"],
                      "Monto": c["Importe"], "Moneda": "MXN", "Fecha de cobro/pago": c["Fecha de pago"]})
    for _, g in t["Gastos"].iterrows():
        filas.append({"Fecha": g["Fecha"], "Tipo": "Gasto", "Concepto": g["Concepto"], "Categoría": g["Categoría"],
                      "Producto": "", "Cantidad": "", "Monto": g["Importe"], "Moneda": g["Moneda"],
                      "Fecha de cobro/pago": g["Fecha de pago"]})
    pd.DataFrame(filas).to_csv(ruta, index=False, encoding="utf-8-sig")
    return ruta
