import { createSlice } from "@reduxjs/toolkit";

const initialState = {};

const tutorialVideos = createSlice({
  name: "tutorialVideos",
  initialState,
  reducers: {
    setTutorialVideos: (state, { payload }) => payload,
  },
});

export const { setTutorialVideos } = tutorialVideos.actions;
export default tutorialVideos.reducer;
