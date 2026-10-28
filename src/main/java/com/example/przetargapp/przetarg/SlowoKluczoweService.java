package com.example.przetargapp.przetarg;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SlowoKluczoweService {
    private final SlowoKluczoweRepository slowoRepository;
    private final SilnikKlasyfikacjiPrzetargow silnik;

    @Transactional(readOnly = true)
    public List<SlowoKluczoweResponse> lista() {
        return slowoRepository.findAllByOrderByTypAscFrazaAsc().stream().map(this::mapToResponse).toList();
    }

    @Transactional
    public SlowoKluczoweResponse utworz(SlowoKluczoweRequest request) {
        String fraza = request.fraza().trim();
        if (slowoRepository.existsByFrazaIgnoreCaseAndTyp(fraza, request.typ())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ta fraza jest już skonfigurowana");
        }
        SlowoKluczowe slowo = new SlowoKluczowe();
        aktualizuj(slowo, request, true);
        slowoRepository.save(slowo);
        silnik.przeliczWszystkie(silnik.uzytkownikSystemowy());
        return mapToResponse(slowo);
    }

    @Transactional
    public SlowoKluczoweResponse aktualizuj(UUID id, SlowoKluczoweRequest request) {
        SlowoKluczowe slowo = znajdz(id);
        if (slowoRepository.existsByFrazaIgnoreCaseAndTypAndIdNot(request.fraza().trim(), request.typ(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ta fraza jest już skonfigurowana");
        }
        aktualizuj(slowo, request, false);
        slowoRepository.save(slowo);
        silnik.przeliczWszystkie(silnik.uzytkownikSystemowy());
        return mapToResponse(slowo);
    }

    @Transactional
    public void usun(UUID id) {
        SlowoKluczowe slowo = znajdz(id);
        slowo.getPrzetargi().forEach(przetarg -> przetarg.getDopasowaneSlowa().remove(slowo));
        slowoRepository.delete(slowo);
        silnik.przeliczWszystkie(silnik.uzytkownikSystemowy());
    }

    private void aktualizuj(SlowoKluczowe slowo, SlowoKluczoweRequest request, boolean nowe) {
        slowo.setFraza(request.fraza().trim());
        slowo.setTyp(request.typ());
        slowo.setKategoria(request.kategoria() == null ? null : request.kategoria().trim());
        slowo.setPunkty(request.punkty() == null ? 1 : request.punkty());
        slowo.setAktywne(request.aktywne() == null ? nowe || slowo.isAktywne() : request.aktywne());
    }

    private SlowoKluczowe znajdz(UUID id) {
        return slowoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono słowa kluczowego"));
    }

    private SlowoKluczoweResponse mapToResponse(SlowoKluczowe slowo) {
        return new SlowoKluczoweResponse(
                slowo.getId(), slowo.getFraza(), slowo.getTyp(), slowo.getKategoria(),
                slowo.getPunkty(), slowo.isAktywne(), slowo.getDataUtworzenia());
    }
}
