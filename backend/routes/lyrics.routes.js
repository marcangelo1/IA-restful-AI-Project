const express = require("express");
const router = express.Router();
const lyricsController = require("../controllers/lyrics.controller");
const { authenticateToken } = require("../middleware/auth");
const { validate, generateLyricsValidation } = require("../validators/validation");

router.post("/generate-lyrics", authenticateToken, generateLyricsValidation, validate, lyricsController.generateLyrics);

module.exports = router;