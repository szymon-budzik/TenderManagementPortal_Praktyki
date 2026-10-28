package com.example.przetargapp.przetarg;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StatystykiPrzetargowService {
    private final PrzetargRepository przetargRepository;
    private final SlowoKluczoweRepository slowoRepository;

    @Transactional(readOnly = true)
    public StatystykiPrzetargowResponse pobierz(LocalDateTime od, LocalDateTime doDaty) {
        if (od != null && doDaty != null && od.isAfter(doDaty)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data początkowa nie może być późniejsza od końcowej");
        }
        List<Przetarg> przetargi = przetargRepository.findAll().stream()
                .filter(przetarg -> od == null || !przetarg.getDataUtworzenia().isBefore(od))
                .filter(przetarg -> doDaty == null || !przetarg.getDataUtworzenia().isAfter(doDaty))
                .toList();
        long wszystkie = przetargi.size();
        long nowe = liczbaStatusu(przetargi, StatusOperacyjny.NOWY);
        long interesujace = liczbaStatusu(przetargi, StatusOperacyjny.INTERESUJACY);
        long odrzucone = liczbaStatusu(przetargi, StatusOperacyjny.ODRZUCONY);
        List<SkutecznoscSlowaKluczowegoResponse> skutecznosc = slowoRepository.findAllByOrderByTypAscFrazaAsc().stream()
                .map(slowo -> {
                    long dopasowania = przetargi.stream()
                            .filter(przetarg -> przetarg.getDopasowaneSlowa().contains(slowo))
                            .count();
                    long interesujaceDopasowania = przetargi.stream()
                            .filter(przetarg -> przetarg.getStatusOperacyjny() == StatusOperacyjny.INTERESUJACY)
                            .filter(przetarg -> przetarg.getDopasowaneSlowa().contains(slowo))
                            .count();
                    return new SkutecznoscSlowaKluczowegoResponse(
                            slowo.getFraza(), slowo.getKategoria(), dopasowania, interesujaceDopasowania);
                })
                .toList();
        return new StatystykiPrzetargowResponse(
                wszystkie, nowe, interesujace, odrzucone,
                percentage(odrzucone, wszystkie), percentage(interesujace, wszystkie), skutecznosc);
    }

    private long liczbaStatusu(List<Przetarg> przetargi, StatusOperacyjny status) {
        return przetargi.stream().filter(przetarg -> przetarg.getStatusOperacyjny() == status).count();
    }

    private double percentage(long count, long total) {
        return total == 0 ? 0.0 : Math.round(count * 10000.0 / total) / 100.0;
    }
}
