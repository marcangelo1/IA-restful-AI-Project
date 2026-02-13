const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate, registrationValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation } = require("../validators/validation");

router.post("/register", registrationValidation, validate, authController.register);
router.post("/login", loginValidation, validate, authController.login);
router.post("/forgot-password", forgotPasswordValidation, validate, authController.forgotPassword);
router.get("/verify-reset-token", authController.verifyResetToken);
router.put("/reset-password", resetPasswordValidation, validate, authController.resetPassword);

module.exports = router;