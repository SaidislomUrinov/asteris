import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  _id: "",
  authType: "", // "owner" | "staff" — qaysi auth zanjiri orqali kirilgani
  name: "",
  phone: "",
  role: "", // faqat staff uchun: reception | teacher | assistant
  permissions: [],
  date: "",
  lastUpdate: "",
  subscription: null,
  trialUsed: false, // mijoz avval tekin sinov muddatidan foydalanganmi
  subscriptionActive: true, // faqat staff uchun: Client Owner'ning obunasi faolmi (verify/signIn javobidan)
  // faqat staff uchun: tarif feature flaglari (Owner'da bu ma'lumot
  // `subscription.tariffSnapshot.allowedPermissions` ichida keladi) — ikkalasini
  // ham `useFeature()` hooki o'qiydi
  tariffFeatures: [],
};

const user = createSlice({
  name: "user",
  initialState,
  reducers: {
    updateUser: (state, { payload }) => {
      return { ...state, ...payload };
    },
    resetUser: (state) => {
      return initialState;
    },
  },
});

export const { updateUser, resetUser } = user.actions;
export default user.reducer;
