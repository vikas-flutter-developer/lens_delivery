// src/redux/store.js
import { configureStore } from "@reduxjs/toolkit";
import lensItemsReducer from "./Slices/lensItemSlice";
import loadingReducer from "./Slices/loadingSlice";

export const store = configureStore({
  reducer: {
    lensItems: lensItemsReducer,
    loading: loadingReducer,
  },
});

export default store;
