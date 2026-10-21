# Teste ascunse pentru t1: comportamentul corect, pe cazuri fără ambiguitate de rotunjire.
import unittest

from facturi.calcul import total_cu_tva, total_factura


class TestAscuns(unittest.TestCase):
    def test_total_cu_tva(self):
        for net, cota, asteptat in [(100, 19, 119.0), (10, 9, 10.9), (0, 19, 0.0), (250, 5, 262.5), (19.99, 19, 23.79)]:
            with self.subTest(net=net, cota=cota):
                self.assertEqual(total_cu_tva(net, cota), asteptat)

    def test_total_factura(self):
        self.assertEqual(total_factura([(3, 4.5), (2, 1.25)], 19), 19.04)
        self.assertEqual(total_factura([], 19), 0.0)
