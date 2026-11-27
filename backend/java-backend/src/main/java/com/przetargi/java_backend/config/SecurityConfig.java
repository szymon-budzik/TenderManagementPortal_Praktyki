package com.przetargi.java_backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final ApiKeyAuthFilter apiKeyAuthFilter;
    private final JwtAuthenticationFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 1. Wpięcie konfiguracji CORS przed regułami autoryzacji
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Endpointy publiczne
                .requestMatchers("/api/auth/**").permitAll()
                // Wewnętrzny ingestion z Pythona
                .requestMatchers("/api/internal/**").permitAll()
                // Panel admina
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // Konfiguracje AI (dostępem do zakładki steruje system ról w panelu)
                .requestMatchers("/api/ai-configs/**").authenticated()
                // Grupy i podgrupy (dostępem do zakładki steruje system ról w panelu)
                .requestMatchers("/api/groups/**").authenticated()
                // Przesyłanie przetargów i raportów między użytkownikami w grupach
                .requestMatchers("/api/shares/**").authenticated()
                // Reszta wymaga uwierzytelnienia
                .anyRequest().authenticated()
            )
            .addFilterBefore(apiKeyAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Porty deweloperskie frontendu (Vite: 5173, React CRA/Next: 3000, lokalny Nginx: 80)
        configuration.setAllowedOriginPatterns(List.of(
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:80",
            "http://127.0.0.1:*"
        ));
        
        // Dozwolone metody HTTP
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        
        // Dozwolone nagłówki (w tym kluczowy Authorization dla Bearer JWT)
        configuration.setAllowedHeaders(List.of(
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "Accept",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
        ));
        
        // Zezwolenie na przesyłanie poświadczeń (ciasteczka/tokeny)
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // Cache preflightu na 1h

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}