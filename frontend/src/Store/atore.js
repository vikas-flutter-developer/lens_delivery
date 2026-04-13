// src/redux/store.js
import { configureStore } from "@reduxjs/toolkit";
import lensItemsReducer from "./Slices/lensItemSlice";

export const store = configureStore({
  reducer: {
    lensItems: lensItemsReducer,
  },
});

export default store;
