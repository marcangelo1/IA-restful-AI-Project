const { body, param, validationResult } = require("express-validator");
const messages = require("../messages");

const sanitizeInput = (value) => {
    if (typeof value !== "string") return value;

    return value
        .trim()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;")
        .replace(/\\/g, "&#92;")
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ");
};

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("Validation Error:", {
            path: req.path,
            method: req.method,
            errors: errors.array(),
        });
        return res.status(400).json({
            errors: errors.array().map((err) => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }
    next();
};

const emailValidationRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const registrationValidation = [
    body("first_name")
        .trim()
        .notEmpty()
        .withMessage(messages.validation.firstNameRequired)
        .isLength({ min: 2, max: 50 })
        .withMessage(messages.validation.firstNameLength)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage(messages.validation.firstNameFormat)
        .customSanitizer(sanitizeInput),

    body("email")
        .trim()
        .notEmpty()
        .withMessage(messages.validation.emailRequired)
        .isEmail()
        .withMessage(messages.validation.emailInvalid)
        .matches(emailValidationRegex)
        .withMessage(messages.validation.emailFormatInvalid)
        .normalizeEmail({
            gmail_remove_dots: false,
            gmail_remove_subaddress: false,
        })
        .customSanitizer(sanitizeInput),

    body("password").notEmpty().withMessage(messages.validation.passwordRequired).customSanitizer(sanitizeInput),
];

const loginValidation = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage(messages.validation.emailRequired)
        .isEmail()
        .withMessage(messages.validation.emailInvalid)
        .matches(emailValidationRegex)
        .withMessage(messages.validation.emailFormatInvalid)
        .normalizeEmail({
            gmail_remove_dots: false,
            gmail_remove_subaddress: false,
        })
        .customSanitizer(sanitizeInput),

    body("password").notEmpty().withMessage(messages.validation.passwordRequired).customSanitizer(sanitizeInput),
];

const generateLyricsValidation = [
    body("artist")
        .trim()
        .notEmpty()
        .withMessage(messages.validation.artistRequired)
        .isLength({ max: 100 })
        .withMessage(messages.validation.artistTooLong)
        .matches(/^[a-zA-Z0-9\s\-']+$/)
        .withMessage(messages.validation.artistInvalidChars)
        .customSanitizer(sanitizeInput),

    body("description")
        .trim()
        .notEmpty()
        .withMessage(messages.validation.descriptionRequired)
        .isLength({ max: 500 })
        .withMessage(messages.validation.descriptionTooLong)
        .matches(/^[a-zA-Z0-9\s\-.,!?']+$/)
        .withMessage(messages.validation.descriptionInvalidChars)
        .customSanitizer(sanitizeInput),

    body("max_length").optional().isInt({ min: 50, max: 200 }).withMessage(messages.validation.lengthRange).toInt(),
];

const userIdValidation = [
    param("id")
        .trim()
        .notEmpty()
        .withMessage(messages.validation.userIdRequired)
        .custom((value) => {
            console.log("Received User ID for validation:", value);

            if (!value) {
                throw new Error(messages.validation.userIdEmpty);
            }

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(value)) {
                console.error("Invalid UUID format:", value);
                throw new Error(messages.validation.userIdInvalid);
            }

            return true;
        }),
];

const deepSanitize = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        return obj.map(deepSanitize);
    }

    const sanitizedObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            sanitizedObj[key] = sanitizeInput(value);
        } else if (typeof value === "object" && value !== null) {
            sanitizedObj[key] = deepSanitize(value);
        } else {
            sanitizedObj[key] = value;
        }
    }
    return sanitizedObj;
};

const forgotPasswordValidation = [body("email").trim().isEmail().withMessage(messages.validation.emailInvalid).normalizeEmail()];

const resetPasswordValidation = [
  body("token").notEmpty().withMessage(messages.validation.resetTokenRequired),
  body("email")
    .trim()
    .isEmail()
    .withMessage(messages.validation.emailInvalid)
    .normalizeEmail(),
  body("password").notEmpty().withMessage(messages.validation.passwordRequired),
];

module.exports = {
    validate,
    sanitizeInput,
    deepSanitize,
    registrationValidation,
    loginValidation,
    generateLyricsValidation,
    userIdValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
};
