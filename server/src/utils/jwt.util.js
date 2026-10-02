const jwt = require("jsonwebtoken");

module.exports = {
  // `expiresIn` berilmasa token muddatsiz (masalan Client/Staff access token —
  // refresh token yo'q, sessiya faqat signOut yoki Redis'dagi access kalit
  // almashtirilganda tugaydi).
  sign: (payload, secret, expiresIn) =>
    jwt.sign(payload, secret, expiresIn ? { expiresIn } : {}),
  // Har qanday yaroqsiz token (boshqa secret, buzilgan, muddati o'tgan) —
  // bitta `auth.failed`. Avval jsonwebtoken'ning xom xabari ("invalid
  // signature", "jwt malformed") qaytardi: frontend faqat `auth.failed`da
  // logout qiladi, error.util esa i18n kaliti bo'lmagan matnni 5xx deb
  // hisoblab, har noto'g'ri tokenda Telegram server-xato alertini yuborardi.
  verify: (token, secret) => {
    try {
      return jwt.verify(token, secret);
    } catch {
      throw new Error("auth.failed");
    }
  },
};
