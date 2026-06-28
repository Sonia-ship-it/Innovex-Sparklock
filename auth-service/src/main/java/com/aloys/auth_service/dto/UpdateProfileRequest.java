package com.aloys.auth_service.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank
    private String fullName;

    @NotBlank
    private String email;

    private String emergencyContact;
    private String location;
    private String profileImage;
}
