package com.example.przetargapp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import com.example.przetargapp.user.Rola;
import com.example.przetargapp.user.User;
import com.example.przetargapp.user.UserRepository;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PrzetargAppApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void administratorCanSearchChangeRolesAndDeleteUsers() throws Exception {
		String suffix = UUID.randomUUID().toString();
		User admin = createUser("Admin", "admin-" + suffix + "@example.com", Rola.ADMIN);
		User target = createUser("Jan", "jan-" + suffix + "@example.com", Rola.USER);
		User regularUser = createUser("User", "user-" + suffix + "@example.com", Rola.USER);

		mockMvc.perform(get("/api/users/admin"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/csrf"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"));
		mockMvc.perform(get("/api/users/recovery-contact"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").exists());
		mockMvc.perform(post("/api/users/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isForbidden());

		MockHttpSession userSession = login(regularUser.getEmail());
		mockMvc.perform(get("/api/users/admin").session(userSession))
				.andExpect(status().isForbidden());

		MockHttpSession adminSession = login(admin.getEmail());
		mockMvc.perform(get("/PanelAdministratora.html").session(adminSession))
				.andExpect(status().isOk())
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.containsString("UzytkownicyAdministratora.html")))
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("id=\"createUserForm\""))));
		mockMvc.perform(get("/UzytkownicyAdministratora.html").session(adminSession))
				.andExpect(status().isOk())
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.containsString("id=\"createUserForm\"")));
		mockMvc.perform(get("/api/users/admin").param("query", target.getEmail()).session(adminSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].email").value(target.getEmail()));

		mockMvc.perform(put("/api/users/admin/{id}/rola", target.getId())
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"rola\":\"ORGANIZER\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rola").value("ORGANIZER"));

		mockMvc.perform(delete("/api/users/admin/{id}", target.getId()).with(csrf()).session(adminSession))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/users/{id}", target.getId()).session(adminSession))
				.andExpect(status().isNotFound());

		mockMvc.perform(delete("/api/users/admin/{id}", admin.getId()).with(csrf()).session(adminSession))
				.andExpect(status().isConflict());

		mockMvc.perform(post("/api/users/logout").with(csrf()).session(adminSession))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/users/admin").session(adminSession))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void registrationReturnsActionableValidationAndDuplicateErrors() throws Exception {
		mockMvc.perform(post("/api/users/rejestracja")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("imie")));

		String email = "rejestracja-" + UUID.randomUUID() + "@example.com";
		String request = """
				{
				  "imie": "Jan",
				  "nazwisko": "Testowy",
				  "telefon": "%s",
				  "email": "%s",
				  "haslo": "bezpieczne123",
				  "rola": "USER"
				}
				""".formatted(uniquePhone(), email);

		mockMvc.perform(post("/api/users/rejestracja")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(request))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/users/rejestracja")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(request))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value(
						org.hamcrest.Matchers.containsString("adresie email")));
	}

	@Test
	void organizerCanPublishAndParticipantCanSubmitOneOffer() throws Exception {
		String suffix = UUID.randomUUID().toString();
		String organizerEmail = "organizator-" + suffix + "@example.com";
		String participantEmail = "wykonawca-" + suffix + "@example.com";
		String organizer = registerUser("Organizator", organizerEmail, "ORGANIZER");
		String participant = registerUser("Wykonawca", participantEmail, "USER");
		MockHttpSession organizerSession = login(organizerEmail);
		MockHttpSession participantSession = login(participantEmail);
		LocalDateTime deadline = LocalDateTime.now().plusDays(2).withNano(0);

		String tenderResponse = mockMvc.perform(post("/api/przetargi")
						.with(csrf())
						.param("organizatorId", organizer)
						.session(organizerSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "tytul": "Dostawa sprzętu",
								  "opis": "Dostawa komputerów dla urzędu",
								  "kategoria": "IT",
								  "lokalizacja": "Warszawa",
								  "terminSkladaniaOfert": "%s"
								}
								""".formatted(deadline)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("OTWARTY"))
				.andReturn().getResponse().getContentAsString();
		String tenderId = extractId(tenderResponse);

		mockMvc.perform(get("/api/przetargi").session(participantSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray());

		mockMvc.perform(post("/api/przetargi/{id}/oferty", tenderId)
						.with(csrf())
						.param("wykonawcaId", participant)
						.session(participantSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "cena": 1200.50,
								  "opis": "Oferta obejmuje dostawę i instalację"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.tytulPrzetargu").value("Dostawa sprzętu"));

		mockMvc.perform(post("/api/przetargi/{id}/oferty", tenderId)
						.with(csrf())
						.param("wykonawcaId", participant)
						.session(participantSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "cena": 1100,
								  "opis": "Druga oferta"
								}
								"""))
				.andExpect(status().isConflict());

		mockMvc.perform(get("/api/przetargi/oferty/uzytkownika/{id}", participant).session(participantSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));

		mockMvc.perform(post("/api/przetargi/{id}/zamknij", tenderId)
						.with(csrf())
						.param("organizatorId", organizer)
						.session(organizerSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ZAMKNIETY"));
	}

	@Test
	void adminCanConfigureRulesAndClassifyTendersWithPerUserStatuses() throws Exception {
		User admin = createUser("Admin", "rules-" + UUID.randomUUID() + "@example.com", Rola.ADMIN);
		MockHttpSession adminSession = login(admin.getEmail());
		User regularUser = createUser("User", "regular-" + UUID.randomUUID() + "@example.com", Rola.USER);
		MockHttpSession regularSession = login(regularUser.getEmail());

		mockMvc.perform(get("/PanelAdministratora.html").session(regularSession))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/UzytkownicyAdministratora.html").session(regularSession))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/PanelPrzetargow.html"))
				.andExpect(status().is3xxRedirection())
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
						.header().string("Location", "/Logowanie.html"));
		mockMvc.perform(get("/PanelPrzetargow.html").session(regularSession))
				.andExpect(status().isOk())
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.containsString("id=\"newTendersSection\"")))
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.containsString("id=\"interestingTendersSection\"")))
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.containsString("statusSelect.addEventListener('change'")))
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
						.string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("sourceFilter"))));

		mockMvc.perform(post("/api/slowa-kluczowe")
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"fraza":"Java","typ":"POSZUKIWANE","kategoria":"IT","punkty":5,"aktywne":true}
								"""))
				.andExpect(status().isCreated());
		mockMvc.perform(post("/api/slowa-kluczowe")
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"fraza":"wykluczone","typ":"WYKLUCZAJACE","punkty":1,"aktywne":true}
								"""))
				.andExpect(status().isCreated());
		mockMvc.perform(get("/api/przetargi/filtry").session(regularSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slowa.length()").value(1))
				.andExpect(jsonPath("$.zrodla").doesNotExist());

		String firstTender = mockMvc.perform(post("/api/przetargi")
						.with(csrf())
						.session(adminSession)
						.param("organizatorId", admin.getId().toString())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "tytul": "Dostawa rozwiązań Java",
								  "opis": "Wdrożenie systemu",
								  "kategoria": "IT",
								  "lokalizacja": "Rzeszów",
								  "terminSkladaniaOfert": "%s"
								}
								""".formatted(LocalDateTime.now().plusDays(7).withNano(0))))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.statusOperacyjny").value("INTERESUJACY"))
				.andExpect(jsonPath("$.punktacja").value(5))
				.andReturn().getResponse().getContentAsString();
		String tenderId = extractId(firstTender);

		mockMvc.perform(post("/api/przetargi")
						.with(csrf())
						.session(adminSession)
						.param("organizatorId", admin.getId().toString())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "tytul": "Dostawa Java wykluczone",
								  "opis": "Wdrożenie systemu",
								  "kategoria": "IT",
								  "lokalizacja": "Rzeszów",
								  "terminSkladaniaOfert": "%s"
								}
								""".formatted(LocalDateTime.now().plusDays(8).withNano(0))))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.statusOperacyjny").value("ODRZUCONY"))
				.andExpect(jsonPath("$.punktacja").value(5));

		mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.patch("/api/przetargi/{id}/status", tenderId)
						.with(csrf())
						.session(regularSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"status\":\"NOWY\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.statusOperacyjny").value("NOWY"));
		mockMvc.perform(get("/api/przetargi/{id}", tenderId).session(adminSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.statusOperacyjny").value("INTERESUJACY"));
		mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.patch("/api/przetargi/{id}/status", tenderId)
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"status\":\"ODRZUCONY\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.statusOperacyjny").value("ODRZUCONY"));
		mockMvc.perform(get("/api/przetargi/{id}", tenderId).session(regularSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.statusOperacyjny").value("NOWY"));
		mockMvc.perform(get("/api/przetargi/{id}/historia", tenderId).session(adminSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));
		mockMvc.perform(get("/api/przetargi/{id}/historia", tenderId).session(regularSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));
		mockMvc.perform(get("/api/przetargi")
						.param("status", "ODRZUCONY")
						.param("minPunktacja", "5")
						.session(adminSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));
		mockMvc.perform(get("/api/przetargi")
						.param("status", "ODRZUCONY")
						.param("minPunktacja", "5")
						.session(regularSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
		User anotherUser = createUser("Another", "another-" + UUID.randomUUID() + "@example.com", Rola.USER);
		MockHttpSession anotherSession = login(anotherUser.getEmail());
		mockMvc.perform(get("/api/przetargi/{id}", tenderId).session(anotherSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.statusOperacyjny").value("INTERESUJACY"));
		mockMvc.perform(get("/api/przetargi")
						.param("status", "INTERESUJACY")
						.param("minPunktacja", "5")
						.session(anotherSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
		mockMvc.perform(get("/api/analytics/przetargi").session(adminSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.liczbaWszystkich").value(2))
				.andExpect(jsonPath("$.liczbaOdrzuconych").value(1));
	}

	@Test
	void adminCanCreateAccountsAndResetPasswords() throws Exception {
		User admin = createUser("Admin", "accounts-" + UUID.randomUUID() + "@example.com", Rola.ADMIN);
		MockHttpSession adminSession = login(admin.getEmail());
		String email = "created-" + UUID.randomUUID() + "@example.com";
		String response = mockMvc.perform(post("/api/users/admin")
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "imie": "Jan",
								  "nazwisko": "Testowy",
								  "telefon": "600123456",
								  "email": "%s",
								  "haslo": "pierwszeHaslo123",
								  "rola": "USER"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String userId = extractId(response);

		mockMvc.perform(put("/api/users/admin/{id}/haslo", userId)
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"haslo\":\"noweHaslo123\"}"))
				.andExpect(status().isNoContent());
		mockMvc.perform(post("/api/users/login")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"email":"%s","haslo":"noweHaslo123"}
								""".formatted(email)))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/users/admin/{id}/rola", userId)
						.with(csrf())
						.session(adminSession)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"rola\":\"ADMIN\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rola").value("ADMIN"));
		MockHttpSession promotedAdminSession = (MockHttpSession) mockMvc.perform(post("/api/users/login")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"email":"%s","haslo":"noweHaslo123"}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn().getRequest().getSession(false);
		mockMvc.perform(get("/api/users/admin").session(promotedAdminSession))
				.andExpect(status().isOk());
	}

	private User createUser(String name, String email, Rola role) {
		return userRepository.save(User.builder()
				.imie(name)
				.nazwisko("Testowy")
				.telefon(uniquePhone())
				.email(email)
				.haslo(passwordEncoder.encode("bezpieczne123"))
				.rola(role)
				.build());
	}

	private String uniquePhone() {
		String phone;
		do {
			phone = String.format("%09d", ThreadLocalRandom.current().nextInt(1_000_000_000));
		} while (userRepository.existsByTelefon(phone));
		return phone;
	}

	private MockHttpSession login(String email) throws Exception {
		return (MockHttpSession) mockMvc.perform(post("/api/users/login")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"email":"%s","haslo":"bezpieczne123"}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn().getRequest().getSession(false);
	}

	private String registerUser(String name, String email, String role) throws Exception {
		String response = mockMvc.perform(post("/api/users/rejestracja")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "imie": "%s",
								  "nazwisko": "Testowy",
								  "telefon": "%s",
								  "email": "%s",
								  "haslo": "bezpieczne123",
								  "rola": "%s"
								}
								""".formatted(name, uniquePhone(), email, role)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return extractId(response);
	}

	private String extractId(String response) {
		Matcher matcher = Pattern.compile("\"id\":\"([^\"]+)\"").matcher(response);
		if (!matcher.find()) {
			throw new AssertionError("Response did not contain an id: " + response);
		}
		return matcher.group(1);
	}
}
