package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.SmtpAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SmtpAccountRepository extends JpaRepository<SmtpAccount, Long> {
    List<SmtpAccount> findAllByOrderByIdAsc();
}