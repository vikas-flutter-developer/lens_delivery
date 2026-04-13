import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isLoading: false,
  activeRequests: 0,
};

const loadingSlice = createSlice({
  name: "loading",
  initialState,
  reducers: {
    startLoading: (state) => {
      state.activeRequests += 1;
      state.isLoading = true;
    },
    stopLoading: (state) => {
      state.activeRequests = Math.max(0, state.activeRequests - 1);
      if (state.activeRequests === 0) {
        state.isLoading = false;
      }
    },
    resetLoading: (state) => {
      state.activeRequests = 0;
      state.isLoading = false;
    },
  },
});

export const { startLoading, stopLoading, resetLoading } = loadingSlice.actions;

export const selectIsLoading = (state) => state.loading.isLoading;

export default loadingSlice.reducer;
