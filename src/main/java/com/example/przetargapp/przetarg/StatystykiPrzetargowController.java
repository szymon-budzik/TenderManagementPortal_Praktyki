package com.example.przetargapp.przetarg;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class StatystykiPrzetargowController {
    private final StatystykiPrzetargowService service;

    @GetMapping("/przetargi")
    public StatystykiPrzetargowResponse pobierz(
            @RequestParam(required = false) LocalDateTime od,
            @RequestParam(required = false) LocalDateTime doDaty) {
        return service.pobierz(od, doDaty);
    }
}
