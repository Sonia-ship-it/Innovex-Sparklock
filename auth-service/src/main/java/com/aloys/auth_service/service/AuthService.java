package com.aloys.auth_service.service;

import com.aloys.auth_service.dto.*;
import com.aloys.auth_service.entity.BlacklistedToken;
import com.aloys.auth_service.entity.OtpCode;
import com.aloys.auth_service.entity.User;
import com.aloys.auth_service.repository.BlacklistedTokenRepository;
import com.aloys.auth_service.repository.UserRepository;
import com.aloys.auth_service.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final BlacklistedTokenRepository blacklistedTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final OtpService otpService;
    private final EmailService emailService;

    @Transactional
    public UserResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("An account with this email already exists.");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .build();

        user = userRepository.save(user);
        log.info("User registered successfully: {}", user.getEmail());

        return UserResponse.fromEntity(user);
    }

    public LoginResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name());

        log.info("User logged in: {}", user.getEmail());

        return LoginResponse.builder()
                .token(token)
                .type("Bearer")
                .user(UserResponse.fromEntity(user))
                .build();
    }

    public ApiResponse logout(String token) {
        try {
            Date expiration = jwtUtil.extractExpiration(token);
            LocalDateTime expiresAt = expiration.toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDateTime();

            BlacklistedToken blacklistedToken = BlacklistedToken.builder()
                    .token(token)
                    .expiresAt(expiresAt)
                    .build();

            blacklistedTokenRepository.save(blacklistedToken);
            log.info("Token blacklisted successfully");
        } catch (Exception e) {
            log.warn("Failed to blacklist token: {}", e.getMessage());
        }

        SecurityContextHolder.clearContext();
        return new ApiResponse(true, "Logged out successfully");
    }

    @Transactional
    public ApiResponse resetPassword(ResetPasswordRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());

        if (userOpt.isPresent()) {
            String otpCode = otpService.generateOtp(userOpt.get());
            log.info("Password reset OTP for {}: {}", userOpt.get().getEmail(), otpCode);

            String message = "Your 4-digit OTP code for password reset is: " + otpCode
                    + ".\nIt will expire in 10 minutes.";
            emailService.sendSimpleMessage(userOpt.get().getEmail(), "Password Reset OTP", message);

            return new ApiResponse(true,
                    "OTP sent successfully.");
        } else {
            log.warn("Password reset requested for non-existent email: {}", request.getEmail());
            throw new IllegalArgumentException("No account found with that email address.");
        }
    }

    @Transactional
    public ApiResponse verifyOtpAndResetPassword(VerifyOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found with email: " + request.getEmail()));

        Optional<OtpCode> validOtp = otpService.validateOtp(user.getId(), request.getCode());

        if (validOtp.isEmpty()) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        log.info("Password reset successful for user: {}", user.getEmail());

        return new ApiResponse(true, "Password reset successfully");
    }

    public UserResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return UserResponse.fromEntity(user);
    }

    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String fullName = request.getFullName();
        if (fullName != null) {
            String[] parts = fullName.trim().split("\\s+", 2);
            user.setFirstName(parts[0]);
            user.setLastName(parts.length > 1 ? parts[1] : "");
        }

        // We aren't changing email securely yet, just ignoring it or enforcing old one
        if (request.getEmergencyContact() != null)
            user.setEmergencyContact(request.getEmergencyContact());
        if (request.getLocation() != null)
            user.setLocation(request.getLocation());
        if (request.getProfileImage() != null)
            user.setProfileImage(request.getProfileImage());

        user = userRepository.save(user);
        log.info("Profile updated for user: {}", email);

        return UserResponse.fromEntity(user);
    }
}
