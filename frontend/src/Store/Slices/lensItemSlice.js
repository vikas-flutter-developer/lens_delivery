// src/redux/lensItemsSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [], // stored selected items across pages
};

const lensItemsSlice = createSlice({
  name: "lensItems",
  initialState,
  reducers: {
    addItems: (state, action) => {
      const newItems = Array.isArray(action.payload) ? action.payload : [];
      newItems.forEach((newItem) => {
        const matchIndex = state.items.findIndex((it) => {
          return (
            String(it.groupId) === String(newItem.groupId) &&
            Number(it.sph) === Number(newItem.sph) &&
            Number(it.cyl) === Number(newItem.cyl) &&
            Number(it.addValue) === Number(newItem.addValue) &&
            String((it.eye || "RL")) === String((newItem.eye || "RL"))
          );
        });

        if (matchIndex !== -1) {
          // merge qty (add)
          state.items[matchIndex].qty =
            Number(state.items[matchIndex].qty || 0) + Number(newItem.qty || 0);

          // optionally update purchasePrice if provided (prefer non-zero new value)
          if ((newItem.purchasePrice || 0) > 0) {
            state.items[matchIndex].purchasePrice = newItem.purchasePrice;
          }
        } else {
          // push a shallow copy to avoid accidental refs
          state.items.push({ ...newItem });
        }
      });
    },

    clearItems: (state) => {
      state.items = [];
    },

    // optional: replaceAll if you want to overwrite entirely
    replaceAll: (state, action) => {
      state.items = Array.isArray(action.payload) ? action.payload.slice() : [];
    },
  },
});

export const { addItems, clearItems, replaceAll } = lensItemsSlice.actions;
export default lensItemsSlice.reducer;
