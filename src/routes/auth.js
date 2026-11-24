const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!username || !password) return res.status(400).json({ error: "Informe login e senha." });

    const result = await pool.query(
      "SELECT id, username, full_name, password_hash, role FROM app_users WHERE username = $1 AND active = TRUE",
      [username]
    );
    const user = result.rows[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) return res.status(401).json({ error: "Login ou senha inválidos." });

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      };
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({ user: req.session.user });
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("estoque.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.session.user }));

module.exports = router;
