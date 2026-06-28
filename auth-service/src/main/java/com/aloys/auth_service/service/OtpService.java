package com.aloys.auth_service.service;

import com.aloys.auth_service.entity.OtpCode;
import com.aloys.auth_service.entity.User;
import com.aloys.auth_service.repository.OtpCodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final OtpCodeRepository otpCodeRepository;
    private static final int OTP_LENGTH = 4;
    private static final int OTP_EXPIRY_MINUTES = 10;

    @Transactional
    public String generateOtp(User user) {
        // Remove existing OTPs for this user
        otpCodeRepository.deleteByUserId(user.getId());

        // Generate a random 6-digit code
        SecureRandom random = new SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < OTP_LENGTH; i++) {
            code.append(random.nextInt(10));
        }

        OtpCode otpCode = OtpCode.builder()
                .userId(user.getId())
                .code(code.toString())
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .build();

        otpCodeRepository.save(otpCode);

        log.info("OTP generated for user {}: {} (expires in {} minutes)",
                user.getEmail(), code, OTP_EXPIRY_MINUTES);

        return code.toString();
    }

    @Transactional
    public Optional<OtpCode> validateOtp(Long userId, String code) {
        Optional<OtpCode> otpOpt = otpCodeRepository
                .findByUserIdAndCodeAndVerifiedFalse(userId, code);

        if (otpOpt.isPresent()) {
            OtpCode otp = otpOpt.get();
            if (otp.getExpiresAt().isBefore(LocalDateTime.now())) {
                log.warn("OTP expired for user ID: {}", userId);
                return Optional.empty();
            }
            otp.setVerified(true);
            otpCodeRepository.save(otp);
            return Optional.of(otp);
        }

        return Optional.empty();
    }
}
