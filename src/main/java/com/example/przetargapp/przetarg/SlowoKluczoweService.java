package com.example.przetargapp.przetarg;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import com.example.przetargapp.user.User;
import com.example.przetargapp.user.UserRepository;

@Service
@RequiredArgsConstructor
public class SlowoKluczoweService {
    private final SlowoKluczoweRepository slowoRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<SlowoKluczoweResponse> lista(UUID wlascicielId) {
        return slowoRepository.findAllByWlascicielIdOrderByTypAscFrazaAsc(wlascicielId).stream().map(this::mapToResponse).toList();
    }

    @Transactional
    public SlowoKluczoweResponse utworz(SlowoKluczoweRequest request, UUID wlascicielId) {
        String fraza = request.fraza().trim();
        if (slowoRepository.existsByWlascicielIdAndFrazaIgnoreCaseAndTyp(wlascicielId, fraza, request.typ())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ta fraza jest już skonfigurowana");
        }
        SlowoKluczowe slowo = new SlowoKluczowe();
        slowo.setWlasciciel(wlasciciel(wlascicielId));
        aktualizuj(slowo, request, true);
        slowoRepository.save(slowo);
        return mapToResponse(slowo);
    }

    @Transactional
    public SlowoKluczoweResponse aktualizuj(UUID id, SlowoKluczoweRequest request, UUID wlascicielId) {
        SlowoKluczowe slowo = znajdz(id, wlascicielId);
        if (slowoRepository.existsByWlascicielIdAndFrazaIgnoreCaseAndTypAndIdNot(wlascicielId, request.fraza().trim(), request.typ(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ta fraza jest już skonfigurowana");
        }
        aktualizuj(slowo, request, false);
        slowoRepository.save(slowo);
        return mapToResponse(slowo);
    }

    @Transactional
    public void usun(UUID id, UUID wlascicielId) {
        SlowoKluczowe slowo = znajdz(id, wlascicielId);
        slowo.getPrzetargi().forEach(przetarg -> przetarg.getDopasowaneSlowa().remove(slowo));
        slowoRepository.delete(slowo);
    }

    private void aktualizuj(SlowoKluczowe slowo, SlowoKluczoweRequest request, boolean nowe) {
        slowo.setFraza(request.fraza().trim());
        slowo.setTyp(request.typ());
        slowo.setKategoria(request.kategoria() == null ? null : request.kategoria().trim());
        slowo.setPunkty(request.punkty() == null ? 1 : request.punkty());
        slowo.setAktywne(request.aktywne() == null ? nowe || slowo.isAktywne() : request.aktywne());
    }

    private SlowoKluczowe znajdz(UUID id, UUID wlascicielId) {
        return slowoRepository.findByIdAndWlascicielId(id, wlascicielId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono słowa kluczowego"));
    }

    private User wlasciciel(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Nie znaleziono zalogowanego uĹĽytkownika"));
    }

    private SlowoKluczoweResponse mapToResponse(SlowoKluczowe slowo) {
        return new SlowoKluczoweResponse(
                slowo.getId(), slowo.getFraza(), slowo.getTyp(), slowo.getKategoria(),
                slowo.getPunkty(), slowo.isAktywne(), slowo.getDataUtworzenia());
    }
}
