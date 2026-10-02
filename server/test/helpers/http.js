// Haqiqiy `src/router.js` ni alohida express ilovasiga ulaydi — `app.js`
// ishlatilmaydi, chunki u import paytida `listen`, socket.io, cron joblar va
// Telegram botni ishga tushiradi. Bu yerda faqat app.js dagi API zanjiri:
// json body → /api router → errorHandler.
require("./env");
const http = require("node:http");
const express = require("express");

const startServer = async () => {
  const router = require("../../src/router");
  const errorHandler = require("../../src/utils/error.util");

  const app = express();
  app.use(express.json());
  app.use("/api", router);
  // errorHandler NODE_ENV != production'da har xatoni console.log qiladi —
  // test chiqishini ifloslamaslik uchun faqat shu chaqiruv paytida jim.
  app.use((err, req, res, next) => {
    const log = console.log;
    console.log = () => {};
    try {
      return errorHandler(err, req, res, next);
    } finally {
      console.log = log;
    }
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const request = async (method, path, { headers = {}, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  const close = () =>
    new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });

  return { request, close };
};

const clientHeader = (token) => ({ "x-client-auth-token": `BerarerClient ${token}` });
const staffHeader = (token) => ({ "x-staff-auth-token": `BerarerStaff ${token}` });

module.exports = { startServer, clientHeader, staffHeader };
