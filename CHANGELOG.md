# Záznam zmien

## [3.5.0] - 2024-03-22

### Pridané
- Možnosť upravovať existujúce záznamy
- Možnosť vymazať záznamy
- Indikácia zmien vo formulári (form-dirty)
- Vylepšené zobrazovanie relatívnych časov (formát Hh MMm)

### Vylepšené
- Lepšie vizuálne odlíšenie typov plienok (cikanie/kakanie)
- Optimalizované zobrazenie modálneho okna pre úpravu
- Lepšia validácia vstupov pri úprave záznamov
- Automatická aktualizácia relatívnych časov každých 10 sekúnd

### Technické
- Pridaná podpora pre PUT a DELETE HTTP metódy
- Vylepšené spracovanie CORS hlavičiek
- Optimalizované API odpovede pre jednotlivé záznamy
- Odstránený nepoužívaný kód

## [3.4.0] - 2024-03-21

### Pridané
- Možnosť manuálneho pridávania záznamov pre všetky typy aktivít
- Nové modálne okno pre pridávanie záznamov
- Oddelené vstupy pre dátum a čas pre lepšiu použiteľnosť
- Tlačidlo plus pre každý typ aktivity

### Vylepšené
- Vylepšené rozloženie ovládacích prvkov pre fľašu
- Optimalizované rozloženie formulárových prvkov v modálnom okne
- Lepšia podpora pre iOS safe area
- Vylepšené vizuálne odlíšenie typov aktivít v modálnom okne

### Technické
- Pridaná ochrana proti zoomovaniu pre lepší mobilný zážitok
- Optimalizované spracovanie dátumu a času
- Vylepšená validácia vstupov

## [3.3.4] - 2024-03-21

### Opravené
- Opravené nekonzistentné zobrazovanie pause/play ikony pri spustení časovača
- Opravená synchronizácia stavu pause/play ikony medzi zariadeniami
- Opravené preblikávanie nesprávnej ikony pri načítaní aktívneho časovača

### Technické
- Zjednotená logika zobrazovania pause/play ikony v celej aplikácii
- Vylepšené spracovanie pause_time v API odpovedi