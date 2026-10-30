package com.example.przetargapp.przetarg;

import java.util.List;

public record StatystykiPrzetargowResponse(
        long liczbaWszystkich,
        long liczbaNowych,
        long liczbaInteresujacych,
        long liczbaOdrzuconych,
        double procentOdrzuconych,
        double procentInteresujacych,
        List<SkutecznoscSlowaKluczowegoResponse> skutecznoscSlowKluczowych
) {
}
