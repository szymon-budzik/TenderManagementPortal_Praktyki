package com.przetargi.java_backend.service;

import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportEmailServiceTest {

    @Mock
    private SmtpAccountRepository smtpAccountRepository;
    @Mock
    private FetchRunRepository fetchRunRepository;
    @Mock
    private ReportExportService reportExportService;

    private ReportEmailService reportEmailService;

    @BeforeEach
    void setUp() {
        reportEmailService = new ReportEmailService(
                smtpAccountRepository,
                fetchRunRepository,
                reportExportService
        );
    }

    @Test
    void parseEmailsSplitsByCommaAndSemicolonAndFiltersInvalidEntries() {
        List<String> emails = reportEmailService.parseEmails(
                " biuro@firma.pl, niepoprawny; oferty@firma.pl ; , admin@example.org "
        );
        assertEquals(List.of("biuro@firma.pl", "oferty@firma.pl", "admin@example.org"), emails);
        assertTrue(reportEmailService.parseEmails("   ").isEmpty());
        assertTrue(reportEmailService.parseEmails(null).isEmpty());
    }

    @Test
    void sendRunsToEmailsRejectsNullOrMissingSmtpAccount() {
        assertThrows(
                IllegalArgumentException.class,
                () -> reportEmailService.sendRunsToEmails(List.of(1L), List.of("a@b.pl"), "Raport", null)
        );

        when(smtpAccountRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(
                IllegalArgumentException.class,
                () -> reportEmailService.sendRunsToEmails(List.of(1L), List.of("a@b.pl"), "Raport", 99L)
        );
    }
}
