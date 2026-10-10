import { createSlice } from "@reduxjs/toolkit";

// Massiv, admin belgilagan tartibda: [{ sectionKey, youtubeUrl, title, order }]
const initialState = [];

const tutorialVideos = createSlice({
  name: "tutorialVideos",
  initialState,
  reducers: {
    setTutorialVideos: (state, { payload }) => payload,
  },
});

export const { setTutorialVideos } = tutorialVideos.actions;
export default tutorialVideos.reducer;
