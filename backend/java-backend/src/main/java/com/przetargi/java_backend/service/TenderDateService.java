package com.przetargi.java_backend.service;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TenderDateService {

    public static final ZoneId POLAND_ZONE = ZoneId.of("Europe/Warsaw");
    public static final DateTimeFormatter PL_DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final List<DateTimeFormatter> LOCAL_DT_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
    );

    private static final List<DateTimeFormatter> LOCAL_DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy")
    );

    private static final Pattern DEADLINE_HINT_PATTERN = Pattern.compile(
            "(?i)(?:termin(?:\\s+sk[łl]adania\\s+ofert)?|sk[łl]adania\\s+ofert|deadline|closing\\s*date|submission\\s*deadline|do\\s+dnia|wa[żz]ne\\s+do)\\s*[:\\-]?\\s*(\\d{4}-\\d{2}-\\d{2}(?:[T\\s]\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:?\\d{2})?)?|\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4}(?:[\\s,]+(?:godz\\.?\\s*)?\\d{2}:\\d{2}(?::\\d{2})?)?)"
    );

    private static final Pattern DATE_EXTRACT_PATTERN = Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2}(?:[T\\s]\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:?\\d{2})?)?|\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4}(?:[\\s,]+(?:godz\\.?\\s*)?\\d{2}:\\d{2}(?::\\d{2})?)?)"
    );

    private static final Pattern DYNAMIC_DATE_TOKEN_PATTERN = Pattern.compile(
            "\\{(TODAY|YESTERDAY|TOMORROW|NOW)(?:([+-])(\\d+)D)?(?:_(COMPACT|START|END|ISO))?\\}",
            Pattern.CASE_INSENSITIVE
    );

    public OffsetDateTime nowPoland() {
        return OffsetDateTime.now(POLAND_ZONE);
    }

    public ZonedDateTime nowPolandZoned() {
        return ZonedDateTime.now(POLAND_ZONE);
    }

    public LocalDateTime nowPolandLocal() {
        return LocalDateTime.now(POLAND_ZONE);
    }

    public String formatPolandDateTime(OffsetDateTime dateTime) {
        if (dateTime == null) return "";
        return dateTime.atZoneSameInstant(POLAND_ZONE).format(PL_DT_FMT);
    }

    /**
     * Podmienia dynamiczne zmienne daty w URL i payloadzie (strefa Europe/Warsaw):
     * {TODAY}, {YESTERDAY}, {TOMORROW}, {TODAY-7D}, {TODAY+3D},
     * {TODAY_COMPACT}, {TODAY-7D_COMPACT}, {TODAY_START}, {TODAY_END}, {TODAY-1D_START}, {NOW_ISO}
     */
    public String resolveDynamicTokens(String raw) {
        if (raw == null || raw.isBlank() || !raw.contains("{")) {
            return raw;
        }
        ZonedDateTime nowPl = nowPolandZoned();
        Matcher matcher = DYNAMIC_DATE_TOKEN_PATTERN.matcher(raw);
        StringBuilder sb = new StringBuilder();

        while (matcher.find()) {
            String base = matcher.group(1).toUpperCase();
            String sign = matcher.group(2);
            String daysStr = matcher.group(3);
            String format = matcher.group(4) != null ? matcher.group(4).toUpperCase() : "";

            LocalDate date = nowPl.toLocalDate();
            if ("YESTERDAY".equals(base)) {
                date = date.minusDays(1);
            } else if ("TOMORROW".equals(base)) {
                date = date.plusDays(1);
            }
            if (sign != null && daysStr != null) {
                long offset = Long.parseLong(daysStr);
                date = "-".equals(sign) ? date.minusDays(offset) : date.plusDays(offset);
            }

            String replacement;
            if ("NOW".equals(base) || "ISO".equals(format)) {
                replacement = nowPl.toLocalDateTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
            } else if ("COMPACT".equals(format)) {
                replacement = date.format(DateTimeFormatter.BASIC_ISO_DATE);
            } else if ("START".equals(format)) {
                replacement = date.format(DateTimeFormatter.ISO_LOCAL_DATE) + "T00:00:00";
            } else if ("END".equals(format)) {
                replacement = date.format(DateTimeFormatter.ISO_LOCAL_DATE) + "T23:59:59";
            } else {
                replacement = date.format(DateTimeFormatter.ISO_LOCAL_DATE);
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    public OffsetDateTime extractDeadlineFromDescription(String desc) {
        if (desc == null || desc.isBlank()) return null;
        for (String line : desc.split("\n")) {
            int idx = line.indexOf(':');
            if (idx > 0) {
                String keyNorm = line.substring(0, idx).toLowerCase().replaceAll("[_\\-\\s]", "");
                if (keyNorm.contains("publication") || keyNorm.contains("publish")
                        || keyNorm.contains("created") || keyNorm.contains("updated")
                        || keyNorm.contains("modified") || keyNorm.contains("start")) {
                    continue;
                }
                if (keyNorm.contains("deadline") || keyNorm.contains("submitting")
                        || keyNorm.contains("submission") || keyNorm.contains("closing")
                        || keyNorm.contains("expir") || keyNorm.contains("validuntil")
                        || keyNorm.contains("enddate") || keyNorm.contains("duedate")
                        || keyNorm.contains("termin")) {
                    OffsetDateTime parsed = parseFlexibleDateTime(line.substring(idx + 1).trim());
                    if (parsed != null) return parsed;
                }
            }
        }
        return extractDeadlineFromText(desc);
    }

    public OffsetDateTime extractDeadlineFromText(String text) {
        if (text == null || text.isBlank()) return null;
        Matcher m = DEADLINE_HINT_PATTERN.matcher(text);
        return m.find() ? parseFlexibleDateTime(m.group(1)) : null;
    }

    public OffsetDateTime parseFlexibleDateTime(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String candidate = raw.trim().replaceAll("(?i)godz\\.?\\s*", "").replace(",", " ").replaceAll("\\s+", " ");
        Matcher m = DATE_EXTRACT_PATTERN.matcher(candidate);
        if (m.find()) {
            candidate = m.group(1).trim().replaceAll("(?i)godz\\.?\\s*", "").replace(",", " ").replaceAll("\\s+", " ");
        }
        try { return OffsetDateTime.parse(candidate); } catch (Exception ignored) {}
        try { return ZonedDateTime.parse(candidate).toOffsetDateTime(); } catch (Exception ignored) {}
        try { return LocalDateTime.parse(candidate).atZone(POLAND_ZONE).toOffsetDateTime(); } catch (Exception ignored) {}
        for (DateTimeFormatter fmt : LOCAL_DT_FORMATS) {
            try { return LocalDateTime.parse(candidate, fmt).atZone(POLAND_ZONE).toOffsetDateTime(); } catch (Exception ignored) {}
        }
        for (DateTimeFormatter fmt : LOCAL_DATE_FORMATS) {
            try { return LocalDate.parse(candidate, fmt).atTime(23, 59).atZone(POLAND_ZONE).toOffsetDateTime(); } catch (Exception ignored) {}
        }
        return null;
    }

    public boolean sameInstant(OffsetDateTime a, OffsetDateTime b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.toInstant().equals(b.toInstant());
    }
}
