package com.example.przetargapp.przetarg;

import com.example.przetargapp.user.Rola;
import com.example.przetargapp.user.User;
import com.example.przetargapp.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

@Service
public class PrzetargService {
    private final PrzetargRepository przetargRepository;
    private final OfertaRepository ofertaRepository;
    private final UserRepository userRepository;
    private final SlowoKluczoweRepository slowoKluczoweRepository;
    private final SilnikKlasyfikacjiPrzetargow silnikKlasyfikacji;
    private final PrzetargHistoriaStatusuRepository historiaRepository;
    private final PrzetargStatusUzytkownikaRepository statusUzytkownikaRepository;

    public PrzetargService(
            PrzetargRepository przetargRepository,
            OfertaRepository ofertaRepository,
            UserRepository userRepository,
            SlowoKluczoweRepository slowoKluczoweRepository,
            SilnikKlasyfikacjiPrzetargow silnikKlasyfikacji,
            PrzetargHistoriaStatusuRepository historiaRepository,
            PrzetargStatusUzytkownikaRepository statusUzytkownikaRepository) {
        this.przetargRepository = przetargRepository;
        this.ofertaRepository = ofertaRepository;
        this.userRepository = userRepository;
        this.slowoKluczoweRepository = slowoKluczoweRepository;
        this.silnikKlasyfikacji = silnikKlasyfikacji;
        this.historiaRepository = historiaRepository;
        this.statusUzytkownikaRepository = statusUzytkownikaRepository;
    }

    @Transactional(readOnly = true)
    public List<PrzetargResponse> listaPrzetargow() {
        return listaPrzetargow(null, null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<PrzetargResponse> listaPrzetargow(
            StatusOperacyjny status,
            LocalDateTime od,
            LocalDateTime doDaty,
            Integer minPunktacja,
            Integer maxPunktacja,
            UUID slowoId,
            String query,
            UUID uzytkownikId) {
        if (od != null && doDaty != null && od.isAfter(doDaty)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data początkowa nie może być późniejsza od końcowej");
        }
        if (minPunktacja != null && maxPunktacja != null && minPunktacja > maxPunktacja) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimalna punktacja nie może przekraczać maksymalnej");
        }
        String fraza = query == null || query.isBlank()
                ? null
                : "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
        Specification<Przetarg> specification = (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (od != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("dataUtworzenia"), od));
            }
            if (doDaty != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("dataUtworzenia"), doDaty));
            }
            if (minPunktacja != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("punktacja"), minPunktacja));
            }
            if (maxPunktacja != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("punktacja"), maxPunktacja));
            }
            if (slowoId != null) {
                var slowa = root.join("dopasowaneSlowa", JoinType.INNER);
                predicates.add(criteriaBuilder.equal(slowa.get("id"), slowoId));
                criteriaQuery.distinct(true);
            }
            if (fraza != null) {
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("tytul")), fraza),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("opis")), fraza),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("kategoria")), fraza),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("lokalizacja")), fraza)));
            }
            criteriaQuery.orderBy(criteriaBuilder.desc(root.get("dataUtworzenia")));
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
        List<Przetarg> przetargi = przetargRepository.findAll(specification);
        java.util.Map<UUID, StatusOperacyjny> statusyUzytkownika = uzytkownikId == null || przetargi.isEmpty()
                ? java.util.Map.of()
                : statusUzytkownikaRepository.findAllByUzytkownikIdAndPrzetargIdIn(
                                uzytkownikId, przetargi.stream().map(Przetarg::getId).toList())
                        .stream()
                        .collect(java.util.stream.Collectors.toMap(
                                PrzetargStatusUzytkownika::getPrzetargId,
                                PrzetargStatusUzytkownika::getStatus));
        return przetargi.stream()
                .map(przetarg -> mapToResponse(
                        przetarg, statusyUzytkownika.getOrDefault(przetarg.getId(), przetarg.getStatusOperacyjny())))
                .filter(przetarg -> status == null || przetarg.statusOperacyjny() == status)
                .toList();
    }

    @Transactional(readOnly = true)
    public OpcjeFiltrowPrzetarguResponse opcjeFiltrowPrzetargu() {
        List<OpcjeFiltrowPrzetarguResponse.OpcjaSlowa> slowa = slowoKluczoweRepository.findAllByAktywneTrue().stream()
                .filter(slowo -> slowo.getTyp() == TypSlowaKluczowego.POSZUKIWANE)
                .map(slowo -> new OpcjeFiltrowPrzetarguResponse.OpcjaSlowa(
                        slowo.getId(), slowo.getFraza(), slowo.getTyp()))
                .toList();
        return new OpcjeFiltrowPrzetarguResponse(slowa);
    }

    @Transactional(readOnly = true)
    public PodsumowaniePrzetargowResponse podsumowanie(UUID uzytkownikId) {
        List<PrzetargResponse> przetargi = listaPrzetargow(
                null, null, null, null, null, null, null, uzytkownikId);
        return new PodsumowaniePrzetargowResponse(
                przetargi.size(),
                przetargi.stream().filter(przetarg -> przetarg.statusOperacyjny() == StatusOperacyjny.NOWY).count(),
                przetargi.stream().filter(przetarg -> przetarg.statusOperacyjny() == StatusOperacyjny.INTERESUJACY).count(),
                przetargi.stream().filter(przetarg -> przetarg.statusOperacyjny() == StatusOperacyjny.ODRZUCONY).count());
    }

    @Transactional(readOnly = true)
    public PrzetargResponse pobierz(UUID id, UUID uzytkownikId) {
        Przetarg przetarg = znajdzPrzetarg(id);
        return mapToResponse(przetarg, statusUzytkownika(przetarg.getId(), uzytkownikId));
    }

    @Transactional(readOnly = true)
    public List<PrzetargHistoriaStatusuResponse> historiaStatusow(UUID przetargId, UUID uzytkownikId) {
        znajdzPrzetarg(przetargId);
        return historiaRepository.findVisibleForUser(przetargId, uzytkownikId).stream()
                .map(historia -> new PrzetargHistoriaStatusuResponse(
                        historia.getId(), historia.getPoprzedniStatus(), historia.getNowyStatus(),
                        historia.getZmienilUzytkownik(), historia.getDataZmiany()))
                .toList();
    }

    @Transactional
    public PrzetargResponse utworz(UUID organizatorId, PrzetargRequest request) {
        User organizator = znajdzOrganizatora(organizatorId);
        Przetarg przetarg = Przetarg.builder()
                .tytul(request.tytul().trim())
                .opis(request.opis().trim())
                .kategoria(request.kategoria().trim())
                .lokalizacja(request.lokalizacja().trim())
                .terminSkladaniaOfert(request.terminSkladaniaOfert())
                .organizator(organizator)
                .build();
        przetarg = przetargRepository.save(przetarg);
        silnikKlasyfikacji.klasyfikuj(przetarg, silnikKlasyfikacji.idUzytkownika(organizatorId));
        return mapToResponse(przetargRepository.save(przetarg));
    }

    @Transactional(readOnly = true)
    public List<PrzetargResponse> przetargiOrganizatora(UUID organizatorId, UUID uzytkownikId) {
        znajdzOrganizatora(organizatorId);
        List<Przetarg> przetargi = przetargRepository.findByOrganizatorIdOrderByDataUtworzeniaDesc(organizatorId);
        java.util.Map<UUID, StatusOperacyjny> statusyUzytkownika = statusyUzytkownika(przetargi, uzytkownikId);
        return przetargi.stream()
                .map(przetarg -> mapToResponse(
                        przetarg, statusyUzytkownika.getOrDefault(przetarg.getId(), przetarg.getStatusOperacyjny())))
                .toList();
    }

    @Transactional
    public PrzetargResponse zamknij(UUID przetargId, UUID organizatorId, UUID uzytkownikId) {
        Przetarg przetarg = znajdzPrzetarg(przetargId);
        if (przetarg.getOrganizator() == null || !przetarg.getOrganizator().getId().equals(organizatorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tylko organizator przetargu może go zamknąć");
        }
        przetarg.setStatus(StatusPrzetargu.ZAMKNIETY);
        return mapToResponse(przetarg, statusUzytkownika(przetargId, uzytkownikId));
    }

    @Transactional
    public PrzetargResponse zmienStatusOperacyjny(UUID przetargId, StatusOperacyjny status, UUID requesterId) {
        Przetarg przetarg = znajdzPrzetarg(przetargId);
        StatusOperacyjny poprzedniStatus = statusUzytkownika(przetargId, requesterId);
        PrzetargStatusUzytkownika statusUzytkownika = statusUzytkownikaRepository
                .findByUzytkownikIdAndPrzetargId(requesterId, przetargId)
                .orElseGet(() -> PrzetargStatusUzytkownika.builder()
                        .uzytkownikId(requesterId)
                        .przetargId(przetargId)
                        .build());
        statusUzytkownika.setStatus(status);
        statusUzytkownikaRepository.save(statusUzytkownika);
        silnikKlasyfikacji.zapiszZmianeStatusuUzytkownika(przetarg, poprzedniStatus, status, requesterId);
        return mapToResponse(przetarg, status);
    }

    @Transactional
    public OfertaResponse zlozOferte(UUID przetargId, UUID wykonawcaId, OfertaRequest request) {
        Przetarg przetarg = znajdzPrzetarg(przetargId);
        if (przetarg.getStatus() != StatusPrzetargu.OTWARTY
                || !przetarg.getTerminSkladaniaOfert().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Termin składania ofert minął lub przetarg jest zamknięty");
        }
        User wykonawca = userRepository.findById(wykonawcaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono użytkownika"));
        if (wykonawca.getRola() != Rola.USER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organizator nie może składać ofert");
        }
        if (przetarg.getOrganizator() != null && przetarg.getOrganizator().getId().equals(wykonawcaId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organizator nie może składać oferty we własnym przetargu");
        }
        if (ofertaRepository.existsByPrzetargIdAndWykonawcaId(przetargId, wykonawcaId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Złożono już ofertę w tym przetargu");
        }

        Oferta oferta = Oferta.builder()
                .przetarg(przetarg)
                .wykonawca(wykonawca)
                .cena(request.cena())
                .opis(request.opis().trim())
                .build();
        return mapToResponse(ofertaRepository.save(oferta));
    }

    @Transactional(readOnly = true)
    public List<OfertaResponse> ofertyUzytkownika(UUID wykonawcaId) {
        userRepository.findById(wykonawcaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono użytkownika"));
        return ofertaRepository.findByWykonawcaIdOrderByDataZlozeniaDesc(wykonawcaId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    private User znajdzOrganizatora(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono użytkownika"));
        if (user.getRola() != Rola.ORGANIZER && user.getRola() != Rola.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Konto nie ma uprawnień organizatora");
        }
        return user;
    }

    private Przetarg znajdzPrzetarg(UUID id) {
        return przetargRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono przetargu"));
    }

    private StatusOperacyjny statusUzytkownika(UUID przetargId, UUID uzytkownikId) {
        if (uzytkownikId == null) {
            return znajdzPrzetarg(przetargId).getStatusOperacyjny();
        }
        return statusUzytkownikaRepository.findByUzytkownikIdAndPrzetargId(uzytkownikId, przetargId)
                .map(PrzetargStatusUzytkownika::getStatus)
                .orElseGet(() -> znajdzPrzetarg(przetargId).getStatusOperacyjny());
    }

    private java.util.Map<UUID, StatusOperacyjny> statusyUzytkownika(List<Przetarg> przetargi, UUID uzytkownikId) {
        if (przetargi.isEmpty()) {
            return java.util.Map.of();
        }
        return statusUzytkownikaRepository.findAllByUzytkownikIdAndPrzetargIdIn(
                        uzytkownikId, przetargi.stream().map(Przetarg::getId).toList())
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        PrzetargStatusUzytkownika::getPrzetargId,
                        PrzetargStatusUzytkownika::getStatus));
    }

    private PrzetargResponse mapToResponse(Przetarg przetarg) {
        return mapToResponse(przetarg, przetarg.getStatusOperacyjny());
    }

    private PrzetargResponse mapToResponse(Przetarg przetarg, StatusOperacyjny statusOperacyjny) {
        String status = przetarg.getStatus() == StatusPrzetargu.ZAMKNIETY
                ? "ZAMKNIETY"
                : przetarg.getTerminSkladaniaOfert().isAfter(LocalDateTime.now()) ? "OTWARTY" : "ZAKONCZONY";
        List<String> frazyDopasowanychSlow = new ArrayList<>();
        for (SlowoKluczowe slowo : przetarg.getDopasowaneSlowa()) {
            frazyDopasowanychSlow.add(slowo.getFraza());
        }
        java.util.Collections.sort(frazyDopasowanychSlow);
        return new PrzetargResponse(
                przetarg.getId(),
                przetarg.getTytul(),
                przetarg.getOpis(),
                przetarg.getKategoria(),
                przetarg.getLokalizacja(),
                przetarg.getTerminSkladaniaOfert(),
                status,
                przetarg.getDataUtworzenia(),
                przetarg.getOrganizator() == null ? null : przetarg.getOrganizator().getId(),
                przetarg.getOrganizator() == null
                        ? "Ogłoszenie zewnętrzne"
                        : przetarg.getOrganizator().getImie() + " " + przetarg.getOrganizator().getNazwisko(),
                ofertaRepository.countByPrzetargId(przetarg.getId()),
                statusOperacyjny,
                przetarg.getPunktacja(),
                frazyDopasowanychSlow
        );
    }

    private OfertaResponse mapToResponse(Oferta oferta) {
        return new OfertaResponse(
                oferta.getId(),
                oferta.getPrzetarg().getId(),
                oferta.getPrzetarg().getTytul(),
                oferta.getCena(),
                oferta.getOpis(),
                oferta.getDataZlozenia()
        );
    }
}
