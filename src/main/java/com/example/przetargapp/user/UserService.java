package com.example.przetargapp.user;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import com.example.przetargapp.przetarg.OfertaRepository;
import com.example.przetargapp.przetarg.PrzetargRepository;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PrzetargRepository przetargRepository;
    private final OfertaRepository ofertaRepository;

    @Transactional
    public UserResponse zarejestruj(RejestrowanieUseraDTO request) {
        if (request.rola() == Rola.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie można utworzyć konta administratora przez rejestrację");
        }
        String email = request.email().trim().toLowerCase(java.util.Locale.ROOT);
        String telefon = request.telefon().trim();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Użytkownik o tym adresie email już istnieje");
        }
        if (userRepository.existsByTelefon(telefon)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Użytkownik o tym telefonie już istnieje");
        }

        User user = User.builder()
                .imie(request.imie().trim())
                .nazwisko(request.nazwisko().trim())
                .email(email)
                .telefon(telefon)
                .haslo(passwordEncoder.encode(request.haslo()))
                .rola(request.rola() == Rola.ORGANIZER ? Rola.ORGANIZER : Rola.USER)
                .build();

        User zapisany = userRepository.save(user);
        return mapToResponse(zapisany);
    }

    @Transactional(readOnly = true)
    public UserResponse pobierzProfil(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono użytkownika"));

        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse zaloguj(LoginRequestDTO request) {
        User user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Nieprawidłowy e-mail lub hasło"));

        if (!passwordEncoder.matches(request.haslo(), user.getHaslo())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Nieprawidłowy e-mail lub hasło");
        }

        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> pobierzUzytkownikow(UUID requesterId, String query) {
        requireAdmin(requesterId);
        List<User> users = query == null || query.isBlank()
                ? userRepository.findAll()
                : userRepository.searchUsers(query.trim());
        return users.stream().map(this::mapToResponse).toList();
    }

    @Transactional
    public UserResponse zmienRole(UUID requesterId, UUID userId, Rola rola) {
        requireAdmin(requesterId);
        if (rola == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rola jest wymagana");
        }
        User user = findUser(userId);
        if (user.getRola() == Rola.ADMIN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie można zmienić roli istniejącego administratora");
        }
        user.setRola(rola);
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse utworzPrzezAdministratora(UUID requesterId, AdminCreateUserRequest request) {
        requireAdmin(requesterId);
        if (request.rola() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rola jest wymagana");
        }
        String email = request.email().trim().toLowerCase(java.util.Locale.ROOT);
        String telefon = request.telefon().trim();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Użytkownik o tym adresie email już istnieje");
        }
        if (userRepository.existsByTelefon(telefon)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Użytkownik o tym telefonie już istnieje");
        }
        User user = User.builder()
                .imie(request.imie().trim())
                .nazwisko(request.nazwisko().trim())
                .email(email)
                .telefon(telefon)
                .haslo(passwordEncoder.encode(request.haslo()))
                .rola(request.rola())
                .build();
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public void resetujHaslo(UUID requesterId, UUID userId, ResetHaslaRequest request) {
        requireAdmin(requesterId);
        User user = findUser(userId);
        user.setHaslo(passwordEncoder.encode(request.haslo()));
        userRepository.save(user);
    }

    @Transactional
    public void usunUzytkownika(UUID requesterId, UUID userId) {
        requireAdmin(requesterId);
        User user = findUser(userId);
        if (user.getRola() == Rola.ADMIN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie można usunąć konta administratora");
        }
        if (przetargRepository.existsByOrganizatorId(userId) || ofertaRepository.existsByWykonawcaId(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Nie można usunąć użytkownika powiązanego z przetargami lub ofertami");
        }
        userRepository.delete(user);
    }

    private void requireAdmin(UUID requesterId) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesja wygasła"));
        if (requester.getRola() != Rola.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień administratora");
        }
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono użytkownika"));
    }

    private UserResponse mapToResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getImie(),
                user.getNazwisko(),
                user.getEmail(),
                user.getTelefon(),
                user.getRola(),
                user.getDataUtworzenia()
        );
    }
}