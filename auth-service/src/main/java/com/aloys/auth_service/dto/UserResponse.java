package com.aloys.auth_service.dto;

import com.aloys.auth_service.entity.Role;
import com.aloys.auth_service.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@Builder
public class UserResponse {
    private Long id;
    private String email;
    private String firstName;
    private String lastName;
    private String emergencyContact;
    private String location;
    private String profileImage;
    private Role role;
    private boolean enabled;
    private LocalDateTime createdAt;

    public static UserResponse fromEntity(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .emergencyContact(user.getEmergencyContact())
                .location(user.getLocation())
                .profileImage(user.getProfileImage())
                .role(user.getRole())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
