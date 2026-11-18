// Numerācija ir no skolas lapas "Tēmu atpazīšana pēc dzirdes".
// youtubeId nāk no atskaņošanas saraksta, ja to drīkst atskaņot iegultā lapā.
// Ja ieraksts iegulšanu liedz, vietā ir cits tā paša gabala ieraksts (replaced).

// start ir sekunde, kurā sākas pati mūzika — pēc klusuma, aplausiem vai runāta pieteikuma.

export const pieces = [
  piece(1, "A.Vivaldi", 'Gada laiki / Vijolkoncerts "Pavasaris" / 1. daļa', "e3nSvIiBNFo", 197, 1.4, 32),
  piece(2, "G.F.Hendelis", 'koris "Alleluja" / oratorija "Mesija"', "IUZEtVbJT5c", 263, 12.4, 36, true),
  piece(3, "J.S.Bahs", "Tokāta un fūga re / ērģelēm", "erXG9vnN-GI", 557, 3.3, 32, true),
  piece(4, "J.S.Bahs", "Ārija / 3.svīta orķestrim", "tuB104s0Yas", 287, 1.2, 34, true),
  piece(5, "J.Haidns", 'simfonija "Pārsteigums" / 2.daļa', "lLjwkamp3lI", 395, 1.4, 45, true),
  piece(6, "V.A.Mocarts", '"Mazā nakts mūzika" stīgu orķestrim / 1.daļa', "oy2zDJPIgwc", 348, 5, 32, true),
  piece(7, "V.A.Mocarts", "40.simfonija / 1.daļa / G.P.", "0sGqkMU-mGQ", 187, 2.4, 30),
  piece(8, "V.A.Mocarts", "sonāte La klavierēm / 3.daļa", "A_THdzBnHy0", 247, 1.9, 34, true),
  piece(9, "V.A.Mocarts", 'Nakts karalienes ārija / opera "Burvju flauta"', "YuBeBjqKSGQ", 181, 0.7, 36),
  piece(10, "L.van Bēthovens", "5.simfonija / 1.daļa / G.P.", "9aDEq3u5huA", 181, 2.6, 28),
  piece(11, "L.van Bēthovens", "Oda priekam / 9.simfonija / 4.daļa", "O3uCdTCA0rA", 132, 3.9, 70, true),
  piece(12, "L.van Bēthovens", "Mēnesnīcas sonāte klavierēm / 1.daļa", "5GOE3w2ZUrQ", 357, 0, 34, true),
  piece(13, "F.Šūberts", 'solodziesma "Ave Maria"', "r_5bYNqpEFU", 296, 0.7, 36, true),
  piece(14, "K.M.Vēbers", 'Mednieku koris / opera "Burvju strēlnieks"', "CvZSASwQSL0", 142, 0.3, 70),
  piece(15, "F.Mendelszons-Bartoldi", 'Kāzu maršs / mūzika lugai "Sapnis vasaras naktī"', "0Oo4z37OUEI", 181, 2.4, 34),
  piece(16, "J.Brāmss", "5. ungāru deju", "3o551FLEX1U", 146, 2.4, 70),
  piece(17, "R.Vāgners", 'Valkīru auļojums / opera "Valkīra"', "GGU1P6lBW6Q", 301, 0.6, 34, true),
  piece(18, "Dž. Verdi", 'Dzīru dziesma / opera "Traviata"', "aNuOf6E-RdM", 69, 0, 64),
  piece(19, "Dž. Verdi", 'Triumfa maršs / opera "Aīda"', "HqNa9Cpa3L8", 466, 8.7, 34),
  piece(20, "Ž.Bizē", 'Karmenas habanera / opera "Karmena"', "Va1W88E-rT0", 276, 2, 36, true),
  piece(21, "F.Šopēns", "Polonēze La klavierēm", "CrTlpMiiHfE", 335, 1.3, 32, true),
  piece(22, "E.Grīgs", 'Rīts / svīta "Pērs Gints"', "QCiQho5DzfY", 166, 0.6, 40),
  piece(23, "M.Musorgskis", '"Mājiņa uz vistas kājām" / klaviercikls "Izstādes gleznas"', "qXuGTWTR_3s", 457, 4.2, 32, true),
  piece(24, "N.Rimskis-Korsakovs", 'Šeherezades tēma / simfoniskā svīta "Šeherezade"', "obPucSY6sig", 632, 2.8, 50, true),
  piece(25, "P.Čaikovskis", "1.klavierkoncerts / 1.daļa / ievads", "YmYeISiVPOw", 201, 2, 34),
  piece(26, "P.Čaikovskis", 'Mazo gulbīšu deja / balets "Gulbju ezers"', "JrsY8eOSf4A", 102, 3.6, 90, true),
  piece(27, "M.Ravels", "Bolero", "s_pSJOkmYBA", 858, 9.8, 34),
  piece(28, "S.Prokofjevs", 'Bruņinieku deja / balets "Romeo un Džuljeta"', "SyDo3h1Tu7c", 110, 2.1, 50),
  piece(29, "A.Jurjāns", 'kantāte "Tēvijai" / pamattēma', "QnCtvZ8E0b8", 539, 0, 34),
  piece(30, "A.Jurjāns", "Latvju vispārējo dziesmu svētku maršs", "TW0uwG0MroY", 202, 0, 34),
  piece(31, "J.Vītols", 'kora balāde "Gaismas pils"', "MkPGcigpmGw", 325, 5.8, 34),
  piece(32, "J.Vītols", 'Variācijas klavierēm par tautasdziesmas "Ej, saulīte, drīz pie Dieva" tēmu', "VwljNj8-3IA", 1050, 0.4, 34),
  piece(33, "E.Melngailis", 'tautasdziesmas apdare korim "Lokatiesi mežu gali"', "AhbwFSF9wFQ", 208, 14.8, 34),
  piece(34, "E.Melngailis", 'kordziesma "Jāņuvakars"', "BLmDFfNOP-A", 350, 0.8, 36, true),
  piece(35, "E.Dārziņš", 'kordziesma "Lauztās priedes"', "fr-RJ6jLJrE", 248, 26.8, 34),
  piece(36, "E.Dārziņš", 'solodziesma "Teici to stundu, to brīdi"', "otkXjqTea3k", 129, 0.3, 70),
  piece(37, "E.Dārziņš", "Melanholiskais valsis", "JCAakhvNeTE", 409, 0.4, 34),
  piece(38, "A.Kalniņš", 'opera "Baņuta", Baņutas vadmotīvs', "NEISZ5Rz2NI", 2231, 1.6, 36),
  piece(39, "A.Kalniņš", 'simfoniskā idille "Mana dzimtene"', "lcaGBJqi268", 227, 1.1, 34),
  piece(40, "A.Kalniņš", 'solodziesma "Brīnos es"', "3d5U9LD7k-A", 255, 0.3, 34),
  piece(41, "Jānis Mediņš", "1.svīta orķestrim, Ārija", "BdzexUzgn_U", 290, 4.7, 34),
  piece(42, "L. Garūta", 'kantāte "Dievs, Tava zeme deg!", sākumtēma', "xsQojVh6-g4", 2669, 0, 50, true),
  piece(43, "P. Barisons", 'kordziesma "Dziesmai šodien liela diena"', "jptNKu_Aws8", 157, 1.1, 70),
  piece(44, "J.Ivanovs", "14. simfonija, 1.daļa", "vtbmI-eRa74", 526, 1.3, 34),
  piece(45, "M.Zariņš", "Partita baroka stilā, Pavana", "MEbUvS-Gb8A", 66, 0.2, 60),
  piece(46, "P.Dambis", 'kordziesmu cikls "Jūras dziesmas", "Pūti, pūti, Vējamāte"', "gR5dKC1HIZo", 149, 0.7, 70),
  piece(47, "I.Kalniņš", "4.simfonija, 1.daļa", "1ZBXaBIAyVM", 870, 0, 34),
  piece(48, "P.Vasks", '"Ainava ar putniem"', "JGACmXn6RAU", 520, 14.7, 34, true),
  piece(49, "M.Brauns", 'dziesma "Saule, Pērkons, Daugava"', "5QtM_15nfJc", 308, 7.6, 34),
  piece(50, "A.Maskats", "Tango", "0LY3fWkDGhE", 715, 4.1, 34),
];

function piece(n, author, details, youtubeId, duration, start, clip, replaced = false) {
  return { n, author, details, youtubeId, duration, start, clip, replaced };
}

export function clipBounds(piece) {
  const start = Math.max(0, piece.start);
  const end = Math.min(piece.duration - 0.25, start + piece.clip);
  return { start, end };
}
