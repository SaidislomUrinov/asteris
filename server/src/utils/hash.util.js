const bcrypt = require("bcrypt");
const SALT = 10;
module.exports = {
  getHash: async (data) => await bcrypt.hash(data, SALT),
  compareHash: async (data, hash) => await bcrypt.compare(data, hash),
};
