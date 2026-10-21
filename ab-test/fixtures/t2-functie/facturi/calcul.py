def rotunjeste(valoare):
    """Rotunjește la ban."""
    return round(valoare, 2)


def total_cu_tva(net, cota):
    """Totalul cu TVA. `cota` e procent, de exemplu 19."""
    return rotunjeste(net * (1 + cota / 100))


def total_factura(linii, cota):
    """`linii` e o listă de (cantitate, pret_unitar)."""
    net = sum(cantitate * pret for cantitate, pret in linii)
    return total_cu_tva(net, cota)
