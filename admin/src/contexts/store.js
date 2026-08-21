import { configureStore } from "@reduxjs/toolkit";
import user from "./user.js";

export default configureStore({
  reducer: {
    user,
  },
});
