const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const redis = require("./redis.config");
const jwtUtil = require("../utils/jwt.util");
const redisUtil = require("../utils/redis.util");
const keyConfig = require("./key.config");
const env = require("./env.config");

let rootIo;
let clientIo;
let adminIo;

// leadId -> { adminId, name, socketId } — leadni hozir kim ko'rayotgani (in-memory, faqat shu worker uchun yetarli)
const leadViewers = new Map();

const waitReady = (client) =>
  new Promise((resolve) => {
    if (client.status === "ready") resolve();
    else client.once("ready", resolve);
  });

// Client ilovasi (Client Owner "Boshliq" va Staff "Hodim") bitta frontendda,
// lekin backendda ikkita mustaqil JWT zanjiri bilan ishlaydi (CLAUDE.md
// "Autentifikatsiya"). Socket ulanishi ham shu ikkalasini qo'llab-quvvatlashi
// kerak — token avval CLIENT_JWT_SECRET bilan, o'tmasa STAFF_JWT_SECRET bilan
// tekshiriladi. Har ikkala holatda ham token faqat `{ _id }` saqlaydi, shuning
// uchun Staff uchun `client`/`center` DB'dan o'qib olinadi (owner uchun esa
// clientId aynan o'zining _id'si).
const authenticateClientSocket = async (socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) return next(new Error("Unauthorized"));

  try {
    let payload;
    let role;
    try {
      payload = jwtUtil.verify(token, env.CLIENT_JWT_SECRET);
      role = "owner";
    } catch {
      payload = jwtUtil.verify(token, env.STAFF_JWT_SECRET);
      role = "staff";
    }

    if (!payload?._id) return next(new Error("Unauthorized"));

    if (role === "owner") {
      // Telegram WebApp tokeni (`ch: "tg"`) o'z slot'i bilan solishtiriladi
      // (API_CONTRACT_worker_webapp.md §1.1) — REST clientAuth bilan bir xil.
      const accessKey = keyConfig.accessFor("client", payload._id, payload.ch === "tg" ? "tg" : "web");
      const cachedAccess = await redisUtil.get(accessKey);
      // REST clientAuth (authenticator.middleware.js) bitta-qurilma tekshiruvini
      // ENFORCE_SINGLE_DEVICE_SESSION bilan gate qiladi (dev'da o'chiq) — socket
      // ham AYNAN shu qoidaga bo'ysunishi kerak, aks holda Redis'dagi cache
      // token bilan localStorage'dagi eskirgan token farqlanganda REST ishlab
      // turadi-yu, socket abadiy "Unauthorized" bilan rad etaveradi.
      if (
        !cachedAccess ||
        (env.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== token)
      )
        return next(new Error("Unauthorized"));

      socket.data.role = "owner";
      socket.data.userId = payload._id;
      socket.data.clientId = payload._id;
    } else {
      const accessKey = keyConfig.accessFor("staff", payload._id, payload.ch === "tg" ? "tg" : "web");
      const cachedAccess = await redisUtil.get(accessKey);
      if (
        !cachedAccess ||
        (env.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== token)
      )
        return next(new Error("Unauthorized"));

      const Staff = require("../models/Staff");
      const staff = await Staff.findOne({ _id: payload._id, isDeleted: false });
      if (!staff || staff.blocked) return next(new Error("Unauthorized"));

      socket.data.role = staff.role;
      socket.data.permissions = staff.permissions || [];
      socket.data.userId = payload._id;
      socket.data.clientId = staff.client;
      socket.data.centerId = staff.center;
    }

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
};

const joinRooms = (socket) => {
  const { userId, clientId, centerId, role, permissions = [] } = socket.data;

  if (userId) socket.join(`user:${userId}`);
  // `client:{id}` — faqat Owner. Hodim o'z filiali (`center:`) va tenant
  // bo'yicha umumiy, maxfiy bo'lmagan hodisalar (`staff:{clientId}`)
  // xonalarida; `client:` hodisalari emitter.util orqali shu xonalarga
  // yo'naltiriladi. Avval hodim ham `client:` da bo'lib, boshqa filial,
  // audit va xarajat hodisalarini olardi.
  if (clientId && role === "owner") socket.join(`client:${clientId}`);
  if (clientId && role !== "owner") socket.join(`staff:${clientId}`);
  if (centerId) socket.join(`center:${centerId}`);
  // Xarajat hodisalari (summalar bilan) — faqat `expense:view` ruxsatli hodim.
  if (centerId && (permissions.includes("all") || permissions.includes("expense:view"))) {
    socket.join(`center:${centerId}:expense`);
  }
};

const authenticateAdminSocket = (socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) return next(new Error("Unauthorized"));

  try {
    const payload = jwtUtil.verify(token, env.ADMIN_JWT_SECRET);
    if (!payload?._id) return next(new Error("Unauthorized"));

    socket.data.userId = payload._id;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
};

const clearLeadViewer = (adminIoNs, socket) => {
  for (const [leadId, viewer] of leadViewers.entries()) {
    if (viewer.socketId === socket.id) {
      leadViewers.delete(leadId);
      adminIoNs.emit("lead:viewingStop", { leadId });
    }
  }
};

const registerLeadPresence = (adminIoNs, socket) => {
  socket.on("lead:view", ({ leadId } = {}) => {
    if (!leadId) return;
    leadId = String(leadId);
    clearLeadViewer(adminIoNs, socket);

    const viewer = {
      adminId: socket.data.userId,
      name: socket.data.name,
      socketId: socket.id,
    };
    leadViewers.set(leadId, viewer);
    adminIoNs.emit("lead:viewing", { leadId, admin: viewer });
  });

  socket.on("lead:unview", ({ leadId } = {}) => {
    if (!leadId) return;
    leadId = String(leadId);
    const viewer = leadViewers.get(leadId);
    if (viewer?.socketId !== socket.id) return;
    leadViewers.delete(leadId);
    adminIoNs.emit("lead:viewingStop", { leadId });
  });

  socket.on("disconnect", () => clearLeadViewer(adminIoNs, socket));
};

const initIo = async (httpServer) => {
  if (rootIo) return clientIo;

  rootIo = new Server(httpServer, {
    cors: {
      origin: env.ORIGINS,
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket"],
    // Mijozlar faqat kichik eventlar yuboradi — 1MB default o'rniga 64KB
    // (katta payload bilan xotira/CPU'ni band qilishdan himoya).
    maxHttpBufferSize: 64 * 1024,
  });

  // Adapter o'z ulanishlarida: u `publish`ni kutmasdan chaqiradi, shuning
  // uchun asosiy klientdagi tez-xato sozlamasi (redis.config.js) bu yerda
  // ushlanmagan rejection bo'lib worker'ni yiqitardi. Bu yerda buyruq
  // Redis qaytguncha navbatda kutadi va hodisa keyin yetkaziladi.
  const pubClient = redis.duplicate({ maxRetriesPerRequest: null, commandTimeout: undefined });
  const subClient = redis.duplicate({ maxRetriesPerRequest: null, commandTimeout: undefined });
  [pubClient, subClient].forEach((c) =>
    c.on("error", (err) => console.error(`Redis adapter error (pid: ${process.pid}):`, err.message)),
  );
  await Promise.all([waitReady(pubClient), waitReady(subClient)]);

  rootIo.adapter(createAdapter(pubClient, subClient));
  console.log(`Worker ${process.pid} initialized`);

  // Client ilovasi (Boshliq + Hodim) shu namespace'ga ulanadi — client.js'dagi
  // `${API}/client` bilan mos.
  clientIo = rootIo.of("/client");
  clientIo.use(authenticateClientSocket);

  clientIo.on("connection", (socket) => {
    joinRooms(socket);
    console.log("Client socket connected:", socket.id);
  });

  adminIo = rootIo.of("/admin");
  adminIo.use(authenticateAdminSocket);

  adminIo.on("connection", async (socket) => {
    joinRooms(socket);

    try {
      const Admin = require("../models/Admin");
      const admin = await Admin.findById(socket.data.userId).select("name");
      socket.data.name = admin?.name || "";
    } catch {
      socket.data.name = "";
    }

    registerLeadPresence(adminIo, socket);
    console.log("Admin socket connected:", socket.id);
  });

  return clientIo;
};

// `emitter.util`dagi `client:{id}`/`center:{id}`/`user:{id}` roomlari faqat
// Client ilovasi (Boshliq/Hodim) socketlari tomonidan tinglanadi — shuning
// uchun getIo() aynan `/client` namespace'ni qaytaradi.
const getIo = () => {
  if (!clientIo) throw new Error("Socket.IO not initialized yet!");
  return clientIo;
};

const getAdminIo = () => {
  if (!adminIo) throw new Error("Admin Socket.IO not initialized yet!");
  return adminIo;
};

const getLeadViewer = (leadId) => leadViewers.get(String(leadId)) || null;

module.exports = { initIo, getIo, getAdminIo, getLeadViewer };
