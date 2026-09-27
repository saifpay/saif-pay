// ========================================
// SAIF PAY - Server
// ========================================

const express = require("express");
const { initializeApp, cert } = require("firebase-admin/app");

const serviceAccount = require("./serviceAccountKey.json");

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// ========================================
// Status
// ========================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    service: "SAIF PAY",
    status: "online"
  });
});

// ========================================
// Start Server
// ========================================

app.listen(PORT, () => {
  console.log(`SAIF PAY server running on http://localhost:${PORT}`);
});