import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  _id: "",
  name: "",
  username: "",
  role: "",
  permissions: "",
  date: "",
  lastUpdate: "",
};

const user = createSlice({
  name: "user",
  initialState,
  reducers: {
    updateUser: (state, { payload }) => {
      return { ...state, ...payload };
    },
    resetUser: () => {
      return initialState;
    },
  },
});

export const { updateUser, resetUser } = user.actions;
export default user.reducer;
