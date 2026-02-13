const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { authenticateToken, checkAdmin } = require("../middleware/auth");
const { validate, userIdValidation } = require("../validators/validation");

router.get("/users", authenticateToken, checkAdmin, adminController.getAllUsers);
router.post("/reset-api-count/:userId", authenticateToken, checkAdmin, adminController.resetApiCount);
router.get("/stats", authenticateToken, checkAdmin, adminController.getStats);
router.delete("/users/:id", authenticateToken, checkAdmin, userIdValidation, validate, adminController.deleteUser);
router.get("/endpoint-stats", authenticateToken, checkAdmin, adminController.getEndpointStats);

module.exports = router;