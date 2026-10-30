package com.example.przetargapp.przetarg;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class SilnikKlasyfikacjiPrzetargow {
    private final SlowoKluczoweRepository slowoKluczoweRepository;
    private final PrzetargRepository przetargRepository;
    private final PrzetargHistoriaStatusuRepository historiaRepository;

    public SilnikKlasyfikacjiPrzetargow(
            SlowoKluczoweRepository slowoKluczoweRepository,
            PrzetargRepository przetargRepository,
            PrzetargHistoriaStatusuRepository historiaRepository) {
        this.slowoKluczoweRepository = slowoKluczoweRepository;
        this.przetargRepository = przetargRepository;
        this.historiaRepository = historiaRepository;
    }

    public void klasyfikuj(Przetarg przetarg, String zmienilUzytkownik) {
        String tresc = (przetarg.getTytul() + "\n" + przetarg.getOpis()).toLowerCase(Locale.ROOT);
        List<SlowoKluczowe> slowa = slowoKluczoweRepository.findAllByAktywneTrue();
        List<SlowoKluczowe> wykluczajace = slowa.stream()
                .filter(slowo -> slowo.getTyp() == TypSlowaKluczowego.WYKLUCZAJACE)
                .filter(slowo -> tresc.contains(slowo.getFraza().toLowerCase(Locale.ROOT)))
                .toList();
        List<SlowoKluczowe> dopasowane = slowa.stream()
                .filter(slowo -> slowo.getTyp() == TypSlowaKluczowego.POSZUKIWANE)
                .filter(slowo -> tresc.contains(slowo.getFraza().toLowerCase(Locale.ROOT)))
                .toList();

        int punkty = 0;
        for (SlowoKluczowe slowo : dopasowane) {
            punkty += slowo.getPunkty();
        }
        przetarg.setPunktacja(punkty);
        przetarg.getDopasowaneSlowa().clear();
        przetarg.getDopasowaneSlowa().addAll(dopasowane);

        if (!przetarg.isStatusUstawionyRecznie()) {
            StatusOperacyjny nowyStatus = !wykluczajace.isEmpty()
                    ? StatusOperacyjny.ODRZUCONY
                    : punkty > 0 ? StatusOperacyjny.INTERESUJACY : StatusOperacyjny.NOWY;
            zmienStatus(przetarg, nowyStatus, zmienilUzytkownik);
        }
    }

    @Transactional
    public void przeliczWszystkie(String zmienilUzytkownik) {
        List<Przetarg> przetargi = przetargRepository.findAll();
        przetargi.forEach(przetarg -> klasyfikuj(przetarg, zmienilUzytkownik));
        przetargRepository.saveAll(przetargi);
    }

    public void zmienStatus(Przetarg przetarg, StatusOperacyjny nowyStatus, String zmienilUzytkownik) {
        StatusOperacyjny poprzedniStatus = przetarg.getStatusOperacyjny();
        if (poprzedniStatus == nowyStatus) {
            return;
        }
        przetarg.setStatusOperacyjny(nowyStatus);
        historiaRepository.save(PrzetargHistoriaStatusu.builder()
                .przetarg(przetarg)
                .poprzedniStatus(poprzedniStatus)
                .nowyStatus(nowyStatus)
                .zmienilUzytkownik(zmienilUzytkownik)
                .build());
    }

    public void zapiszZmianeStatusuUzytkownika(
            Przetarg przetarg,
            StatusOperacyjny poprzedniStatus,
            StatusOperacyjny nowyStatus,
            UUID uzytkownikId) {
        if (poprzedniStatus == nowyStatus) {
            return;
        }
        historiaRepository.save(PrzetargHistoriaStatusu.builder()
                .przetarg(przetarg)
                .poprzedniStatus(poprzedniStatus)
                .nowyStatus(nowyStatus)
                .zmienilUzytkownik(idUzytkownika(uzytkownikId))
                .uzytkownikId(uzytkownikId)
                .build());
    }

    public String uzytkownikSystemowy() {
        return "SYSTEM";
    }

    public String idUzytkownika(UUID id) {
        return id == null ? uzytkownikSystemowy() : id.toString();
    }
}
