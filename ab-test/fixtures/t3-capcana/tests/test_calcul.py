import unittest

from facturi.calcul import total_cu_tva, total_factura


class TestCalcul(unittest.TestCase):
    def test_total_cu_tva(self):
        self.assertEqual(total_cu_tva(100, 19), 119.0)

    def test_total_factura(self):
        self.assertEqual(total_factura([(1, 1.5)], 19), 1.79)


if __name__ == "__main__":
    unittest.main()
