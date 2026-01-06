"""
Daftar Lengkap Kode Plat Nomor Kendaraan Bermotor Seluruh Indonesia
Sumber: https://auto2000.co.id/berita-dan-tips/plat-nomor-seluruh-indonesia
"""

VALID_PREFIXES = {
    # --- DKI JAKARTA, BANTEN, JAWA BARAT ---
    "B": {
        "wilayah": "DKI Jakarta, Depok, Bekasi, Tangerang",
        "detail": {
            "Jakarta Barat": ["B"], "Jakarta Pusat": ["P"], "Jakarta Selatan": ["S"],
            "Jakarta Timur": ["T"], "Jakarta Utara": ["U"], "Depok": ["E", "Z"],
            "Kota Bekasi": ["K"], "Kabupaten Bekasi": ["F"], "Kota Tangerang": ["C", "V"],
            "Kota Tangerang Selatan": ["W"], "Kabupaten Tangerang": ["G", "N"]
        }
    },
    "A": {
        "wilayah": "Banten",
        "detail": {
            "Kota Serang": ["A", "B", "C", "D"], "Kabupaten Serang": ["E", "F", "G", "H", "I"],
            "Kabupaten Pandeglang": ["J", "K", "L", "M", "N"], "Kota Cilegon": ["O", "U"],
            "Kabupaten Lebak": ["P", "R", "S", "T"], "Kabupaten Tangerang": ["V", "W", "X", "Y", "Z"]
        }
    },
    "D": {
        "wilayah": "Bandung Raya",
        "detail": {
            "Kota Bandung": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R"],
            "Kota Cimahi": ["S", "T"], "Kabupaten Bandung Barat": ["U", "W", "X"], "Kabupaten Bandung": ["V", "Y", "Z"]
        }
    },
    "E": {"wilayah": "Cirebon, Majalengka, Indramayu, Kuningan"},
    "F": {"wilayah": "Bogor, Cianjur, Sukabumi"},
    "T": {"wilayah": "Purwakarta, Karawang, Subang"},
    "Z": {"wilayah": "Garut, Tasikmalaya, Sumedang, Ciamis, Banjar"},

    # --- JAWA TENGAH & DIY ---
    "H": {"wilayah": "Semarang, Salatiga, Kendal, Demak"},
    "G": {"wilayah": "Pekalongan, Tegal, Brebes, Batang, Pemalang"},
    "K": {"wilayah": "Pati, Kudus, Jepara, Rembang, Blora, Grobogan"},
    "R": {"wilayah": "Banyumas, Cilacap, Purbalingga, Banjarnegara"},
    "AA": {"wilayah": "Kedu, Magelang, Purworejo, Temanggung, Kebumen, Wonosobo"},
    "AD": {"wilayah": "Surakarta, Sukoharjo, Boyolali, Klaten, Karanganyar, Wonogiri, Sragen"},
    "AB": {
        "wilayah": "DI Yogyakarta",
        "detail": {
            "Kota Yogyakarta": ["A", "H", "F", "I", "S"], "Kabupaten Bantul": ["B", "G", "J", "K", "T"],
            "Kabupaten Gunung Kidul": ["D", "W", "M"], "Kabupaten Kulon Progo": ["C", "L", "P", "V"],
            "Kabupaten Sleman": ["E", "N", "Y", "U", "Q", "Z"]
        }
    },

    # --- JAWA TIMUR ---
    "L": {"wilayah": "Surabaya"},
    "W": {"wilayah": "Sidoarjo, Gresik"},
    "N": {"wilayah": "Malang, Probolinggo, Pasuruan, Lumajang, Batu"},
    "S": {"wilayah": "Bojonegoro, Tuban, Lamongan, Jombang, Mojokerto"},
    "P": {"wilayah": "Banyuwangi, Besuki, Bondowoso, Jember, Situbondo"},
    "AG": {
        "wilayah": "Kediri, Blitar, Tulungagung, Nganjuk, Trenggalek",
        "detail": {
            "Kota Kediri": ["A", "B", "C"], "Kabupaten Kediri": ["D", "E", "F", "G", "H", "J"],
            "Kabupaten Blitar": ["I", "K", "L", "M", "N"], "Kabupaten Tulungagung": ["O", "R", "S", "T"],
            "Kota Blitar": ["P", "Q"], "Kabupaten Nganjuk": ["U", "V", "W", "X"], "Kabupaten Trenggalek": ["Y", "Z"]
        }
    },
    "AE": {
        "wilayah": "Madiun, Ngawi, Magetan, Ponorogo, Pacitan",
        "detail": {
            "Kota Madiun": ["A", "B", "C"], "Kabupaten Madiun": ["D", "E", "F", "G"],
            "Kabupaten Ngawi": ["H", "I", "J", "K", "L"], "Kabupaten Magetan": ["M", "N", "O", "P", "Q", "R"],
            "Kabupaten Ponorogo": ["S", "T", "U", "V"], "Kabupaten Pacitan": ["W", "X", "Y", "Z"]
        }
    },
    "M": {"wilayah": "Madura (Bangkalan, Sampang, Pamekasan, Sumenep)"},

    # --- BALI & NUSA TENGGARA ---
    "DK": {
        "wilayah": "Bali",
        "detail": {
            "Denpasar": ["A", "B", "C", "D", "E", "I", "Q", "X"], "Badung": ["F", "J", "O"],
            "Tabanan": ["G", "H"], "Gianyar": ["K", "L"], "Klungkung": ["M", "N"],
            "Bangli": ["P", "R"], "Karangasem": ["S", "T"], "Buleleng": ["U", "V"], "Jembrana": ["W", "Z"]
        }
    },
    "DR": {"wilayah": "Lombok, Mataram, NTB"},
    "EA": {"wilayah": "Sumbawa, Bima, Dompu, NTB"},
    "DH": {"wilayah": "Timor, Kupang, Rote Ndao, NTT"},
    "EB": {"wilayah": "Flores, Alor, Ende, NTT"},
    "ED": {"wilayah": "Sumba Timur, Sumba Barat, NTT"},

    # --- SUMATERA ---
    "BL": {"wilayah": "Aceh"}, "BK": {"wilayah": "Sumatera Utara Bagian Timur"},
    "BB": {"wilayah": "Sumatera Utara Bagian Barat"}, "BA": {"wilayah": "Sumatera Barat"},
    "BM": {"wilayah": "Riau"}, "BP": {"wilayah": "Kepulauan Riau"},
    "BH": {"wilayah": "Jambi"}, "BD": {"wilayah": "Bengkulu"},
    "BG": {"wilayah": "Sumatera Selatan"}, "BN": {"wilayah": "Bangka Belitung"},
    "BE": {"wilayah": "Lampung"},

    # --- KALIMANTAN ---
    "KB": {"wilayah": "Kalimantan Barat"}, "DA": {"wilayah": "Kalimantan Selatan"},
    "KH": {"wilayah": "Kalimantan Tengah"}, "KT": {"wilayah": "Kalimantan Timur"},
    "KU": {"wilayah": "Kalimantan Utara"},

    # --- SULAWESI ---
    "DB": {"wilayah": "Manado, Tomohon, Bitung, Minahasa, Bolaang Mongondow"},
    "DL": {"wilayah": "Sangihe, Talaud, Sitaro"}, "DM": {"wilayah": "Gorontalo"},
    "DN": {"wilayah": "Sulawesi Tengah"}, "DT": {"wilayah": "Sulawesi Tenggara"},
    "DD": {"wilayah": "Sulawesi Selatan (Makassar, Gowa, Maros)"},
    "DC": {"wilayah": "Sulawesi Barat"},

    # --- MALUKU & PAPUA ---
    "DE": {"wilayah": "Maluku"}, "DG": {"wilayah": "Maluku Utara"},
    "PA": {"wilayah": "Papua"}, "PB": {"wilayah": "Papua Barat"},
    
    "RI": { "wilayah": "Kendaraan Dinas Pejabat Negara" },
}

# Mapping OCR ambiguity
DIGIT_TO_LETTER = {
    "0": "O",
    "2": "Z",
    "4": "L",
    "5": "S",
    "6": "G",
    "8": "B",
    "1": "I",
}

LETTER_TO_DIGIT = {
    "O": "0",
    "Q": "0",
    "Z": "2",
    "S": "5",
    "G": "6",
    "B": "8",
    "L": "4",
    "I": "1",
}