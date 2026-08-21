const jwt = require("jsonwebtoken");

module.exports = {
  sign: (payload, secret, expiresIn = "1d") =>
    jwt.sign(payload, secret, { expiresIn }),
  verify: (token, secret) => jwt.verify(token, secret),
};
