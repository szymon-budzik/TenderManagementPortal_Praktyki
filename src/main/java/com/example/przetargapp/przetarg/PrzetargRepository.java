package com.example.przetargapp.przetarg;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.UUID;

public interface PrzetargRepository extends JpaRepository<Przetarg, UUID>, JpaSpecificationExecutor<Przetarg> {
    List<Przetarg> findAllByOrderByDataUtworzeniaDesc();
    List<Przetarg> findByOrganizatorIdOrderByDataUtworzeniaDesc(UUID organizatorId);
    boolean existsByOrganizatorId(UUID organizatorId);
}
