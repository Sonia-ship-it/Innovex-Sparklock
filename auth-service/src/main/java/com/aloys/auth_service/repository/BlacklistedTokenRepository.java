package com.aloys.auth_service.repository;

import com.aloys.auth_service.entity.BlacklistedToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface BlacklistedTokenRepository extends JpaRepository<BlacklistedToken, Long> {

    boolean existsByToken(String token);

    void deleteByExpiresAtBefore(LocalDateTime now);
}
