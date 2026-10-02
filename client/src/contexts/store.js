import { configureStore } from "@reduxjs/toolkit";
import user from "./user.js";
import tutorialVideos from "./tutorialVideos.js";
import news from "./news.js";

export default configureStore({
  reducer: {
    user,
    tutorialVideos,
    news,
  },
});
