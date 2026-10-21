# Teste ascunse pentru t2: funcția nouă, plus că restul n-a fost stricat.
import unittest

from facturi.calcul import aplica_discount, total_cu_tva


class TestAscuns(unittest.TestCase):
    def test_discount(self):
        for suma, procent, asteptat in [(100, 10, 90.0), (99.99, 0, 99.99), (50, 100, 0.0), (10, 33.333, 6.67), (200, 12.5, 175.0)]:
            with self.subTest(suma=suma, procent=procent):
                self.assertEqual(aplica_discount(suma, procent), asteptat)

    def test_procent_invalid(self):
        for procent in (-1, 100.01, 150):
            with self.subTest(procent=procent):
                with self.assertRaises(ValueError):
                    aplica_discount(100, procent)

    def test_restul_neatins(self):
        self.assertEqual(total_cu_tva(100, 19), 119.0)
