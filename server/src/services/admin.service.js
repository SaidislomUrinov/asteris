const crypto = require("crypto");
const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const Admin = require("../models/Admin");
const { compareHash, getHash } = require("../utils/hash.util");
const jwtUtil = require("../utils/jwt.util");
const redisUtil = require("../utils/redis.util");

const generateApiKey = () => crypto.randomBytes(24).toString("hex");

const DTO = (data) => {
  return {
    _id: data?._id,
    name: data?.name,
    username: data?.username,
    role: data?.role,
    permissions: data?.permissions,
    date: data?.date,
    lastUpdate: data?.lastUpdate,
  };
};

const issueTokens = (adminId) => {
  const access = jwtUtil.sign(
    { _id: adminId },
    envConfig.ADMIN_JWT_SECRET,
    envConfig.ADMIN_ACCESS_EXPIRES_IN,
  );
  const refresh = jwtUtil.sign(
    { _id: adminId },
    envConfig.ADMIN_REFRESH_JWT_SECRET,
    "30d", // absolyut chegara, haqiqiy amal qilish muddati Redis TTL (24s harakatsizlik) orqali boshqariladi
  );

  return { access, refresh };
};

module.exports = {
  DTO,
  signIn: async (body) => {
    const { username, password } = body;
    if (!username || !password) throw new Error("auth.fillTheRows");
    const admin = await Admin.findOne({
      username: username?.toLowerCase()?.trim(),
    });

    if (!admin) throw new Error("auth.notFound");
    const checkPass = await compareHash(password?.trim(), admin.password);

    if (!checkPass) throw new Error("auth.notFound");

    const data = DTO(admin);
    const { access, refresh } = issueTokens(admin._id);

    admin.access = access;
    const key = keyConfig.admin(admin._id);
    const accessKey = keyConfig.adminAccess(admin._id);
    const refreshKey = keyConfig.adminRefresh(admin._id);
    await Promise.all([
      admin.save(),
      redisUtil.set(key, data, envConfig.ADMIN_SESSION_TTL),
      redisUtil.set(accessKey, access, envConfig.ADMIN_SESSION_TTL),
      redisUtil.set(refreshKey, refresh, envConfig.ADMIN_SESSION_TTL),
    ]);

    return {
      data,
      access,
      refresh,
    };
  },

  refresh: async (refreshToken) => {
    if (!refreshToken) throw new Error("auth.failed");

    let payload;
    try {
      payload = jwtUtil.verify(
        refreshToken,
        envConfig.ADMIN_REFRESH_JWT_SECRET,
      );
    } catch {
      throw new Error("auth.failed");
    }

    const adminId = payload?._id;
    if (!adminId) throw new Error("auth.failed");

    const refreshKey = keyConfig.adminRefresh(adminId);
    const cachedRefresh = await redisUtil.get(refreshKey);

    // Redis'dagi refresh token muddati tugagan (24 soat harakatsizlik) yoki boshqa
    // sessiya bilan almashtirilgan bo'lsa, foydalanuvchi qayta login qilishi kerak
    if (!cachedRefresh || cachedRefresh !== refreshToken)
      throw new Error("auth.failed");

    const admin = await Admin.findOne({ _id: adminId });
    if (!admin) throw new Error("auth.failed");

    const data = DTO(admin);
    const { access, refresh } = issueTokens(adminId);

    admin.access = access;
    const key = keyConfig.admin(adminId);
    const accessKey = keyConfig.adminAccess(adminId);
    await Promise.all([
      admin.save(),
      redisUtil.set(key, data, envConfig.ADMIN_SESSION_TTL),
      redisUtil.set(accessKey, access, envConfig.ADMIN_SESSION_TTL),
      redisUtil.set(refreshKey, refresh, envConfig.ADMIN_SESSION_TTL),
    ]);

    return {
      data,
      access,
      refresh,
    };
  },

  getApiKey: async (adminId) => {
    const admin = await Admin.findById(adminId);
    if (!admin) throw new Error("auth.failed");

    if (!admin.apiKey) {
      admin.apiKey = generateApiKey();
      await admin.save();
    }

    return admin.apiKey;
  },

  regenerateApiKey: async (adminId) => {
    const admin = await Admin.findById(adminId);
    if (!admin) throw new Error("auth.failed");

    admin.apiKey = generateApiKey();
    await admin.save();

    return admin.apiKey;
  },

  updateProfile: async (adminId, body) => {
    const { name, currentPassword, newPassword } = body || {};
    if (!name?.trim() && !newPassword?.trim())
      throw new Error("admin.nothingToUpdate");

    const admin = await Admin.findById(adminId);
    if (!admin) throw new Error("auth.failed");

    if (newPassword?.trim()) {
      const checkPass = await compareHash(
        currentPassword?.trim() || "",
        admin.password,
      );
      if (!checkPass) throw new Error("admin.wrongPassword");
      admin.password = await getHash(newPassword.trim());
    }

    if (name?.trim()) admin.name = name.trim();

    await admin.save();
    return DTO(admin);
  },

  signOut: async (admin) => {
    const key = keyConfig.admin(admin._id);
    const accessKey = keyConfig.adminAccess(admin._id);
    const refreshKey = keyConfig.adminRefresh(admin._id);
    await Promise.all([
      Admin.updateOne({ _id: admin._id }, { $set: { access: "" } }),
      redisUtil.del(key),
      redisUtil.del(accessKey),
      redisUtil.del(refreshKey),
    ]);

    return true;
  },
};
