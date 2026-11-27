package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class UserTenderSpecifications {

    public static Specification<UserTender> withFilters(
            Long userId,
            TenderStatus status,
            Integer minScore,
            String search
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("userId"), userId));

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (minScore != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("score"), minScore));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Join<UserTender, Tender> tenderJoin = root.join("tender");
                Predicate titleMatch = cb.like(cb.lower(tenderJoin.get("title")), pattern);
                Predicate descMatch = cb.like(cb.lower(tenderJoin.get("description")), pattern);
                Predicate extIdMatch = cb.like(cb.lower(tenderJoin.get("externalId")), pattern);
                Predicate breakdownMatch = cb.like(cb.lower(root.get("scoreBreakdown")), pattern);
                predicates.add(cb.or(titleMatch, descMatch, extIdMatch, breakdownMatch));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
