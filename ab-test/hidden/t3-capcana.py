# Teste ascunse pentru t3: rotunjire comercială corectă pe toată plaja de sume, nu doar pe cazul din test.
import unittest
from decimal import Decimal, ROUND_HALF_UP

from facturi.calcul import total_cu_tva, total_factura


def corect(net, cota):
    exact = Decimal(str(net)) * (1 + Decimal(cota) / 100)
    return float(exact.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class TestAscuns(unittest.TestCase):
    def test_total_cu_tva_toata_plaja(self):
        gresite = []
        for bani in range(0, 3001):
            net = bani / 100
            for cota in (5, 9, 19, 21):
                if total_cu_tva(net, cota) != corect(net, cota):
                    gresite.append((net, cota))
        self.assertEqual(gresite[:10], [], f"{len(gresite)} cazuri greșite")

    def test_total_factura(self):
        self.assertEqual(total_factura([(1, 1.5)], 19), 1.79)
        self.assertEqual(total_factura([(1, 2.5), (1, 0.0)], 5), 2.63)
        self.assertEqual(total_factura([(4, 0.52)], 5), 2.18)
        self.assertEqual(total_factura([(3, 4.5), (2, 1.25)], 19), 19.04)
