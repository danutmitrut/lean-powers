import unittest

from facturi.calcul import total_cu_tva, total_factura


class TestCalcul(unittest.TestCase):
    def test_total_cu_tva(self):
        self.assertEqual(total_cu_tva(100, 19), 119.0)

    def test_total_factura(self):
        self.assertEqual(total_factura([(2, 10), (1, 30)], 19), 59.5)


if __name__ == "__main__":
    unittest.main()
