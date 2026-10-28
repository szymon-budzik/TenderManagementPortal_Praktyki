package com.example.przetargapp.przetarg;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class KlasyfikacjaZapisanychPrzetargowInitializer implements ApplicationRunner {
    private final SilnikKlasyfikacjiPrzetargow silnik;

    @Override
    public void run(ApplicationArguments args) {
        silnik.przeliczWszystkie(silnik.uzytkownikSystemowy());
    }
}
