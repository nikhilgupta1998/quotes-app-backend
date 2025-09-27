const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User } = require("../models");
const { sendEmail } = require("../utils/email");
// const { sendSMS } = require("../utils/sms");
const { validateRegistration, validateLogin } = require("../utils/validation");

class AuthController {
  // Register with email or mobile
  static async register(req, res) {
    try {
      const { error } = validateRegistration(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      const { username, email, mobile, password, firstName, lastName } =
        req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          $or: [
            { username },
            ...(email ? [{ email }] : []),
            ...(mobile ? [{ mobile }] : []),
          ],
        },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this username, email, or mobile",
        });
      }

      // Create user
      const user = await User.create({
        username,
        email,
        mobile,
        password,
        firstName,
        lastName,
      });

      // Send verification
      if (email) {
        await AuthController.sendEmailVerification(user);
      }
      // if (mobile) {
      //   await AuthController.sendMobileVerification(user);
      // }

      // Generate JWT
      const token = AuthController.generateAccessToken(user.id);
      const refreshToken = AuthController.generateRefreshToken(user.id);

      // Save refresh token
      await user.update({ refreshToken });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user,
          token,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Login with email/mobile and password
  static async login(req, res) {
    try {
      const { error } = validateLogin(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      const { identifier, password } = req.body;

      // Find user by email, mobile, or username
      const user = await User.findOne({
        where: {
          $or: [
            { email: identifier },
            { mobile: identifier },
            { username: identifier },
          ],
        },
      });

      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      // Update last active
      await user.update({ lastActiveAt: new Date() });

      // Generate tokens
      const token = AuthController.generateAccessToken(user.id);
      const refreshToken = AuthController.generateRefreshToken(user.id);

      // Save refresh token
      await user.update({ refreshToken });

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user,
          token,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Verify email
  static async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        where: { emailVerificationToken: token },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification token",
        });
      }

      await user.update({
        isEmailVerified: true,
        emailVerificationToken: null,
      });

      res.json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Verify mobile OTP
  static async verifyMobile(req, res) {
    try {
      const { mobile, otp } = req.body;

      const user = await User.findOne({
        where: {
          mobile,
          mobileVerificationCode: otp,
          mobileVerificationExpires: {
            $gt: new Date(),
          },
        },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP",
        });
      }

      await user.update({
        isMobileVerified: true,
        mobileVerificationCode: null,
        mobileVerificationExpires: null,
      });

      res.json({
        success: true,
        message: "Mobile verified successfully",
      });
    } catch (error) {
      console.error("Mobile verification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Resend email verification
  static async resendEmailVerification(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified",
        });
      }

      await AuthController.sendEmailVerification(user);

      res.json({
        success: true,
        message: "Verification email sent successfully",
      });
    } catch (error) {
      console.error("Resend email verification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Resend mobile OTP
  static async resendMobileOTP(req, res) {
    try {
      const { mobile } = req.body;

      const user = await User.findOne({ where: { mobile } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isMobileVerified) {
        return res.status(400).json({
          success: false,
          message: "Mobile is already verified",
        });
      }

      // await AuthController.sendMobileVerification(user);

      res.json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (error) {
      console.error("Resend mobile OTP error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Forgot password
  static async forgotPassword(req, res) {
    try {
      const { identifier } = req.body; // email or mobile

      const user = await User.findOne({
        where: {
          $or: [{ email: identifier }, { mobile: identifier }],
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      // Send reset link via email or OTP via SMS
      if (user.email === identifier) {
        await sendEmail({
          to: user.email,
          subject: "Password Reset",
          html: `
            <h2>Password Reset Request</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${process.env.FRONTEND_URL}/reset-password/${resetToken}">Reset Password</a>
            <p>This link expires in 10 minutes.</p>
          `,
        });
      } else {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await user.update({
          mobileVerificationCode: otp,
          mobileVerificationExpires: resetExpires,
        });

        // await sendSMS(
        //   user.mobile,
        //   `Your password reset OTP is: ${otp}. Valid for 10 minutes.`
        // );
      }

      res.json({
        success: true,
        message: "Password reset instructions sent",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Reset password
  static async resetPassword(req, res) {
    try {
      const { token, password, otp, mobile } = req.body;

      let user;

      if (token) {
        // Email reset
        user = await User.findOne({
          where: {
            passwordResetToken: token,
            passwordResetExpires: {
              $gt: new Date(),
            },
          },
        });
      } else if (otp && mobile) {
        // Mobile reset
        user = await User.findOne({
          where: {
            mobile,
            mobileVerificationCode: otp,
            mobileVerificationExpires: {
              $gt: new Date(),
            },
          },
        });
      }

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token/OTP",
        });
      }

      await user.update({
        password,
        passwordResetToken: null,
        passwordResetExpires: null,
        mobileVerificationCode: null,
        mobileVerificationExpires: null,
      });

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Refresh token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token required",
        });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findOne({
        where: {
          id: decoded.userId,
          refreshToken,
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      const newAccessToken = AuthController.generateAccessToken(user.id);
      const newRefreshToken = AuthController.generateRefreshToken(user.id);

      await user.update({ refreshToken: newRefreshToken });

      res.json({
        success: true,
        data: {
          token: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const user = req.user;
      await user.update({ refreshToken: null });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Helper methods
  static generateAccessToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });
  }

  static generateRefreshToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE,
    });
  }

  static async sendEmailVerification(user) {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await user.update({ emailVerificationToken: verificationToken });

    await sendEmail({
      to: user.email,
      subject: "Email Verification",
      html: `
        <h2>Welcome to Our Social Media Platform!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${process.env.FRONTEND_URL}/verify-email/${verificationToken}">Verify Email</a>
      `,
    });
  }

  // static async sendMobileVerification(user) {
  //   const otp = Math.floor(100000 + Math.random() * 900000).toString();
  //   const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  //   await user.update({
  //     mobileVerificationCode: otp,
  //     mobileVerificationExpires: expires,
  //   });

  //   await sendSMS(
  //     user.mobile,
  //     `Your verification OTP is: ${otp}. Valid for 10 minutes.`
  //   );
  // }
}

module.exports = AuthController;
