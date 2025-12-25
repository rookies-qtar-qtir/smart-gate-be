"""
Daftar kode plat nomor kendaraan bermotor Indonesia
Sumber: https://auto2000.co.id/berita-dan-tips/plat-nomor-seluruh-indonesia
"""

VALID_PREFIXES = {
    # Jawa Tengah
    "AA",  # Purworejo, Kedu, Temanggung, Magelang, Wonosobo, Kebumen
    "AD",  # Surakarta (Solo), Boyolali, Klaten, Wonogiri, Karanganyar, Sragen, Sukoharjo
    "K",   # Cepu, Pati, Kudus, Jepara, Grobogan, Rembang, Blora
    "R",   # Banjarnegara, Banyumas, Cilacap, Purbalingga
    "G",   # Brebes, Pemalang, Batang, Tegal, Pekalongan
    "H",   # Salatiga, Semarang, Kendal, Demak
    
    # DIY (Daerah Istimewa Yogyakarta)
    "AB",  # Yogyakarta, Sleman, Bantul, Kulon Progo, Gunung Kidul
    
    # Jawa Barat
    "D",   # Bandung, Kabupaten Bandung, Bandung Barat, Cimahi
    "F",   # Bogor, Sukabumi, Cianjur
    "E",   # Cirebon, Indramayu, Majalengka, Kuningan
    "Z",   # Banjar, Garut, Ciamis, Tasikmalaya, Sumedang
    "T",   # Subang, Purwakarta, Karawang
    
    # Banten
    "A",   # Tangerang, Cilegon, Lebak, Serang, Pandeglang
    
    # DKI Jakarta
    "B",   # Jakarta (Jakarta Pusat, Utara, Barat, Selatan, Timur, Kepulauan Seribu)
    
    # Jawa Timur
    "AG",  # Tulungagung, Kediri, Blitar, Trenggalek, Nganjuk
    "AE",  # Ngawi, Madiun, Pacitan, Ponorogo, Magetan
    "L",   # Surabaya
    "M",   # Madura (Bangkalan, Sampang, Sumenep, Pamekasan)
    "N",   # Malang, Pasuruan, Probolinggo, Batu, Lumajang
    "S",   # Tuban, Jombang, Bojonegoro, Lamongan, Mojokerto
    "W",   # Gresik, Sidoarjo
    "P",   # Banyuwangi, Besuki, Bondowoso, Jember, Situbondo
    
    # Bali & Nusa Tenggara
    "DK",  # Bali (Denpasar, Badung, Gianyar, Tabanan, Klungkung, Bangli, Karangasem, Buleleng, Jembrana)
    "ED",  # Sumba (Sumba Timur, Sumba Barat)
    "EA",  # Sumbawa (Sumbawa, Bima, Dompu, Sumbawa Barat)
    "EB",  # Flores (Alor, Lembata, Sikka, Ende, Ngada, Flores Timur, Flores, Manggarai, Manggarai Barat)
    "DH",  # Timor (Rote Ndao, Kupang, Timor, Timor Tengah Selatan, Timor Tengah Utara)
    "DR",  # Lombok (Lombok, Lombok Tengah, Lombok Timur, Lombok Barat, Mataram)
    
    # Kalimantan
    "KU",  # Kalimantan Utara
    "KT",  # Kalimantan Timur
    "DA",  # Kalimantan Selatan
    "KB",  # Kalimantan Barat
    "KH",  # Kalimantan Tengah
    
    # Sulawesi
    "DC",  # Sulawesi Barat
    "DD",  # Sulawesi Selatan
    "DN",  # Sulawesi Tengah
    "DT",  # Sulawesi Tenggara
    "DL",  # Sulawesi Utara (Sitaro, Talaud, Sangihe)
    "DM",  # Gorontalo
    "DB",  # Sulawesi Utara (Bolaang Mongondow, Bolaang Mongondow Timur, Bolaang Mongondow Selatan, Manado, Tomohon, Minahasa, Bitung)
    
    # Sumatra
    "BA",  # Sumatera Barat
    "BB",  # Sumatera Utara Bagian Barat
    "BD",  # Bengkulu
    "BE",  # Lampung
    "BG",  # Sumatera Selatan
    "BH",  # Jambi
    "BK",  # Sumatera Utara Bagian Timur
    "BL",  # Aceh (Banda Aceh, Lhokseumawe, Meulaboh)
    "BM",  # Riau
    "BN",  # Bangka Belitung
    "BP",  # Kepulauan Riau
    
    # Maluku
    "DE",  # Maluku
    "DG",  # Maluku Utara
    
    # Papua
    "PA",  # Papua
    "PB",  # Papua Barat
}

# Mapping OCR ambiguity
DIGIT_TO_LETTER = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "4": "L",
    "5": "S",
    "6": "G",
    "8": "B",
}

LETTER_TO_DIGIT = {
    "O": "0",
    "Q": "0",
    "I": "1",
    "Z": "2",
    "S": "5",
    "G": "6",
    "B": "8",
    "L": "4",
}