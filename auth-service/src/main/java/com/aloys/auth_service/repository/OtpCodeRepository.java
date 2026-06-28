package com.aloys.auth_service.repository;

import com.aloys.auth_service.entity.OtpCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OtpCodeRepository extends JpaRepository<OtpCode, Long> {
    Optional<OtpCode> findByUserIdAndCodeAndVerifiedFalse(Long userId, String code);

    @Modifying
    void deleteByUserId(Long userId);
}
